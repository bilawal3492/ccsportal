<?php
namespace CCSPortal\Rest;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Custom authentication for the standalone React admin — so staff never touch
 * wp-login or wp-admin. Login sets the normal WordPress auth cookie (same
 * session mechanism), gated by the portal capability. Account changes
 * (name / email / password) and logout all happen in-app.
 */
class Auth {

    const NS = 'ccsp/v1';

    public function routes() {
        register_rest_route(self::NS, '/login', [
            'methods'             => 'POST',
            'callback'            => [$this, 'login'],
            'permission_callback' => '__return_true',
        ]);
        register_rest_route(self::NS, '/logout', [
            'methods'             => 'POST',
            'callback'            => [$this, 'logout'],
            'permission_callback' => 'is_user_logged_in',
        ]);
        register_rest_route(self::NS, '/account', [
            'methods'             => 'POST',
            'callback'            => [$this, 'account'],
            'permission_callback' => [$this, 'can_use'],
        ]);
    }

    public function can_use() {
        return is_user_logged_in() && current_user_can('ccsp_use_portal');
    }

    /* ------------------------------------------------------------------ */

    public function login(WP_REST_Request $req) {
        $username = trim((string) $req->get_param('username'));
        $password = (string) $req->get_param('password');

        if ($username === '' || $password === '') {
            return new WP_Error('ccsp_login', 'Enter your email and password.', ['status' => 400]);
        }

        // Light brute-force throttle per IP.
        $ip  = $this->client_ip();
        $key = 'ccsp_login_fail_' . md5($ip);
        $fails = (int) get_transient($key);
        if ($fails >= 8) {
            return new WP_Error('ccsp_login_locked', 'Too many attempts. Please wait a few minutes and try again.', ['status' => 429]);
        }

        // Supports username OR email (WordPress default authenticate chain).
        $user = wp_authenticate($username, $password);
        if (is_wp_error($user)) {
            set_transient($key, $fails + 1, 15 * MINUTE_IN_SECONDS);
            return new WP_Error('ccsp_login', 'Incorrect email or password.', ['status' => 401]);
        }

        if (!user_can($user, 'ccsp_use_portal')) {
            return new WP_Error('ccsp_noaccess', 'This account does not have portal access. Please contact your administrator.', ['status' => 403]);
        }

        delete_transient($key);
        wp_set_current_user($user->ID);
        wp_set_auth_cookie($user->ID, true, is_ssl());

        return new WP_REST_Response(['ok' => true], 200);
    }

    public function logout() {
        wp_logout();
        return new WP_REST_Response(['ok' => true], 200);
    }

    public function account(WP_REST_Request $req) {
        $user = wp_get_current_user();
        $data = ['ID' => $user->ID];

        $name = sanitize_text_field($req->get_param('display_name'));
        if ($name !== '' && $name !== $user->display_name) {
            $data['display_name'] = $name;
        }

        // Cast: the password form posts no email field, and sanitize_email(null)
        // is deprecated on PHP 8.1+.
        $email = sanitize_email((string) $req->get_param('email'));
        if ($email !== '' && $email !== $user->user_email) {
            if (!is_email($email)) {
                return new WP_Error('ccsp_email', 'Please enter a valid email.', ['status' => 400]);
            }
            if (email_exists($email)) {
                return new WP_Error('ccsp_email', 'That email is already in use.', ['status' => 409]);
            }
            $data['user_email'] = $email;
        }

        $new = (string) $req->get_param('new_password');
        if ($new !== '') {
            $current = (string) $req->get_param('current_password');
            $check = wp_authenticate($user->user_login, $current);
            if (is_wp_error($check)) {
                return new WP_Error('ccsp_pw', 'Your current password is incorrect.', ['status' => 403]);
            }
            if (strlen($new) < 8) {
                return new WP_Error('ccsp_pw', 'New password must be at least 8 characters.', ['status' => 400]);
            }
            $data['user_pass'] = $new;
        }

        if (count($data) === 1) {
            return new WP_REST_Response(['ok' => true, 'name' => $user->display_name, 'email' => $user->user_email], 200);
        }

        $res = wp_update_user($data);
        if (is_wp_error($res)) {
            return new WP_Error('ccsp_account', $res->get_error_message(), ['status' => 400]);
        }

        // Changing the password rotates session tokens — keep this session alive.
        if (isset($data['user_pass'])) {
            wp_set_auth_cookie($user->ID, true, is_ssl());
        }

        $fresh = get_userdata($user->ID);
        return new WP_REST_Response(['ok' => true, 'name' => $fresh->display_name, 'email' => $fresh->user_email], 200);
    }

    private function client_ip() {
        return isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '0.0.0.0';
    }
}
