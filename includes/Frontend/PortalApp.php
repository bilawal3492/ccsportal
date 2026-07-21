<?php
namespace CCSPortal\Frontend;

use CCSPortal\Data\Repo;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * The React SaaS app, rendered by [ccs_portal_app] on a login-gated page.
 * Super admins manage everything; centre managers see their scoped estimates,
 * leads and reports. React + htm are vendored locally (no build step).
 */
class PortalApp {

    const SHORTCODE = 'ccs_portal_app';

    public function register() {
        add_shortcode(self::SHORTCODE, [$this, 'render']);
        add_action('wp_enqueue_scripts', [$this, 'maybe_enqueue']);
    }

    public function maybe_enqueue() {
        if (!is_singular()) {
            return;
        }
        $post = get_post();
        if (!$post || !has_shortcode($post->post_content, self::SHORTCODE)) {
            return;
        }
        if (!is_user_logged_in() || !current_user_can('ccsp_use_portal')) {
            return;
        }

        $v = CCSP_VERSION;
        wp_enqueue_style('ccsp-app', CCSP_URL . 'assets/css/app.css', [], $v);
        wp_enqueue_script('ccsp-react', CCSP_URL . 'assets/vendor/react.production.min.js', [], '18.3.1', true);
        wp_enqueue_script('ccsp-react-dom', CCSP_URL . 'assets/vendor/react-dom.production.min.js', ['ccsp-react'], '18.3.1', true);
        wp_enqueue_script('ccsp-htm', CCSP_URL . 'assets/vendor/htm.umd.js', [], '3.1.1', true);
        wp_enqueue_script('ccsp-app', CCSP_URL . 'assets/js/app.js', ['ccsp-react', 'ccsp-react-dom', 'ccsp-htm'], $v, true);

        wp_localize_script('ccsp-app', 'CCSP_APP', [
            'root'   => esc_url_raw(rest_url('ccsp/v1/')),
            'nonce'  => wp_create_nonce('wp_rest'),
            'assets' => esc_url_raw(CCSP_URL . 'assets/'),
        ]);
    }

    public function render() {
        if (!is_user_logged_in()) {
            return '<div class="ccsp-app-gate"><h2>Staff sign-in required</h2><p>Please sign in to access the portal.</p>'
                . wp_login_form(['echo' => false, 'redirect' => get_permalink()]) . '</div>';
        }
        if (!current_user_can('ccsp_use_portal')) {
            return '<div class="ccsp-app-gate"><h2>No portal access</h2><p>Your account is not set up to use the CCS Portal. Please contact your administrator.</p></div>';
        }
        return '<div id="ccsp-app-root" class="ccsp-app-root">' . self::loading_markup('Loading portal…') . '</div>';
    }

    /**
     * Branded, centred loading state shown before React mounts (and reused by the
     * full-screen document). The i9 mark inherits colour via currentColor so it
     * themes correctly, with the label underneath.
     */
    public static function loading_markup($label = 'Loading…') {
        $mark = '<svg height="42" viewBox="0 0 94 179" fill="currentColor" aria-hidden="true">'
            . '<path d="M34.87 100.02C33.37 98.86 31.98 97.47 30.75 95.77C26.84 90.38 24.89 83.2 24.89 74.21C24.89 66.33 26.77 59.61 30.52 54.04C31.87 52.04 33.32 50.42 34.86 49.14V39.7C26.44 41.27 19.14 44.82 12.94 50.37C4.32 58.1 0 67.81 0 79.5C0 89.7 3.4 98.26 10.21 105.18C16.87 111.95 25.09 115.39 34.86 115.53V100.01L34.87 100.02Z"></path>'
            . '<path d="M80.47 53.43C73.5 45.85 64.88 41.24 54.66 39.53V49.51C56.76 51.27 58.64 53.62 60.27 56.58C64.29 63.86 66.3 73.66 66.3 85.99C66.3 89.26 66 92.67 65.4 96.24C61.95 99.18 58.36 101.25 54.65 102.48V111.89C57.7 110.82 60.82 109.53 64.06 107.96C62.42 126.75 56.89 142.15 47.48 154.15C38.07 166.15 25.66 173.42 10.25 175.95V178.97C25.35 178.97 39.29 175.05 52.05 167.19C64.81 159.34 74.99 148.53 82.58 134.75C90.17 120.98 93.96 106.58 93.96 91.54C93.96 75.91 89.46 63.2 80.46 53.42"></path>'
            . '<path d="M58.06 13.46C58.06 20.93 51.78 26.91 44.61 26.91C37.44 26.91 31.16 20.93 31.16 13.46C31.16 5.99 37.43 0 44.61 0C51.79 0 58.06 5.98 58.06 13.46Z"></path>'
            . '</svg>';
        return '<div class="ccsp-app-loading"><span class="loader-mark">' . $mark . '</span>'
            . '<span class="loader-txt">' . esc_html($label) . '</span></div>';
    }
}
