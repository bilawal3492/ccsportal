<?php
namespace CCSPortal\Admin;

if (!defined('ABSPATH')) {
    exit;
}

/** Small presentation helpers shared by the admin controllers. */
class UI {

    /** Render a success/error notice from the ?msg query arg. */
    public static function notice() {
        if (empty($_GET['msg'])) {
            return;
        }
        $map = [
            'saved'    => ['success', 'Changes saved.'],
            'created'  => ['success', 'Created successfully.'],
            'deleted'  => ['success', 'Deleted.'],
            'assigned' => ['success', 'Assignment updated.'],
            'error'    => ['error', 'Something went wrong. Please try again.'],
            'nocap'    => ['error', 'You do not have permission to do that.'],
        ];
        $key = sanitize_key(wp_unslash($_GET['msg']));
        if (!isset($map[$key])) {
            return;
        }
        list($type, $text) = $map[$key];
        printf('<div class="notice notice-%s is-dismissible"><p>%s</p></div>', esc_attr($type), esc_html($text));
    }

    /** Build a <select>. */
    public static function select($name, array $options, $selected, array $attrs = []) {
        $a = '';
        foreach ($attrs as $k => $v) {
            $a .= ' ' . esc_attr($k) . '="' . esc_attr($v) . '"';
        }
        $html = '<select name="' . esc_attr($name) . '"' . $a . '>';
        foreach ($options as $val => $label) {
            $html .= '<option value="' . esc_attr($val) . '"' . selected((string) $val, (string) $selected, false) . '>' . esc_html($label) . '</option>';
        }
        return $html . '</select>';
    }

    /** URL to a portal admin page. */
    public static function url($page, array $args = []) {
        return add_query_arg(array_merge(['page' => $page], $args), admin_url('admin.php'));
    }

    /** Redirect back to a portal page with a message, then exit. */
    public static function redirect($page, $msg, array $args = []) {
        wp_safe_redirect(self::url($page, array_merge($args, ['msg' => $msg])));
        exit;
    }

    /** Verify a nonce + capability or die cleanly. */
    public static function guard($action, $cap) {
        if (!current_user_can($cap)) {
            wp_die('You do not have permission to perform this action.');
        }
        check_admin_referer($action);
    }
}
