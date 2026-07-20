<?php
namespace CCSPortal\Frontend;

use CCSPortal\Data\Repo;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Renders the portal app and the calculator as full-screen, standalone
 * documents that bypass the site theme entirely, so the portal looks and
 * behaves like a dedicated SaaS application rather than a page inside the site.
 */
class FullScreen {

    public function register() {
        add_action('template_redirect', [$this, 'maybe_render'], 0);
    }

    public function maybe_render() {
        if (is_admin() || !is_page()) {
            return;
        }
        $current = (int) get_queried_object_id();
        $app_id  = (int) get_option('ccsp_app_page_id');
        $calc_id = (int) get_option('ccsp_portal_page_id');

        if ($current && $current === $app_id) {
            $this->render('app');
        } elseif ($current && $current === $calc_id) {
            $this->render('calc');
        }
    }

    private function render($type) {
        // The app renders for everyone, the React app shows its own custom
        // login screen when the visitor is not authenticated (no wp-login).
        if ($type === 'app') {
            $this->render_app();
            exit;
        }

        // The standalone calculator page still requires a session; send guests
        // to the app's custom login rather than wp-login.
        if (!is_user_logged_in()) {
            $app = (int) get_option('ccsp_app_page_id');
            wp_safe_redirect($app ? get_permalink($app) : home_url('/'));
            exit;
        }
        if (!current_user_can('ccsp_use_portal')) {
            $this->document('Access', '<div class="ccsp-app-gate"><h2>No portal access</h2><p>Your account is not set up to use the CCS Portal. Please contact your administrator.</p></div>', '', [], '');
            exit;
        }
        $this->render_calc();
        exit;
    }

    private function render_app() {
        $body = '<div id="ccsp-app-root" class="ccsp-app-root"><div class="ccsp-app-loading">Loading portal…</div></div>';
        $scripts = $this->script_tag('assets/vendor/react.production.min.js')
            . $this->script_tag('assets/vendor/react-dom.production.min.js')
            . $this->script_tag('assets/vendor/htm.umd.js')
            . $this->script_tag('assets/js/app.js');
        $data = [
            'root'  => esc_url_raw(rest_url('ccsp/v1/')),
            'nonce' => wp_create_nonce('wp_rest'),
        ];
        $this->document('Centre CCS Portal', $body, 'app.css', $data, $scripts, 'CCSP_APP');
    }

    private function render_calc() {
        if (empty(Repo::accessible_centres())) {
            $this->document('Centre CCS Portal', '<div class="ccsp-app-gate"><h2>No centre assigned</h2><p>You have portal access but no centre is assigned yet. Please contact your administrator.</p></div>', 'portal.css', [], '');
            return;
        }
        $portal = new Portal();
        $body = $portal->shell();

        $centres = [];
        foreach (Repo::accessible_centres() as $c) {
            $centres[] = Repo::centre_bootstrap($c);
        }
        $data = [
            'root'     => esc_url_raw(rest_url('ccsp/v1/')),
            'nonce'    => wp_create_nonce('wp_rest'),
            'centres'  => $centres,
            'user'     => wp_get_current_user()->display_name,
            'engineOk' => class_exists(CCSP_ENGINE_CLASS),
        ];
        $scripts = $this->script_tag('assets/js/portal.js');
        $this->document('Centre CCS Portal', $body, 'portal.css', $data, $scripts, 'CCSP_PORTAL', true);
    }

    /** Emit the standalone HTML document. */
    private function document($title, $body, $css, array $data, $scripts, $var = '', $with_backlink = false) {
        nocache_headers();
        header('Content-Type: text/html; charset=' . get_bloginfo('charset'));
        $app_url = ($p = (int) get_option('ccsp_app_page_id')) ? get_permalink($p) : '';
        ?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php echo esc_attr(get_bloginfo('charset')); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="robots" content="noindex, nofollow">
    <title><?php echo esc_html($title); ?></title>
    <?php if ($css) : ?>
    <link rel="stylesheet" href="<?php echo esc_url(CCSP_URL . 'assets/css/' . $css . '?ver=' . CCSP_VERSION); ?>">
    <?php endif; ?>
    <style>
        html, body { margin: 0; padding: 0; background: #f4f6fb; min-height: 100%; }
        body.ccsp-fs { -webkit-font-smoothing: antialiased; }
        @media (prefers-color-scheme: dark) { html, body { background: #0e1014; } }
        .ccsp-fs-topexit { position: fixed; top: 14px; right: 18px; z-index: 99; font: 600 13px/1 -apple-system, "Segoe UI", sans-serif; color: #6a7078; text-decoration: none; background: #fff; border: 1px solid #e4e7ee; padding: 8px 12px; border-radius: 8px; }
    </style>
</head>
<body class="ccsp-fs">
    <?php if ($with_backlink && $app_url) : ?>
        <a class="ccsp-fs-topexit" href="<?php echo esc_url($app_url); ?>">← Portal</a>
    <?php endif; ?>
    <?php echo $body; // phpcs:ignore WordPress.Security.EscapeOutput ?>
    <?php if ($var) : ?>
        <script>window.<?php echo esc_js($var); ?> = <?php echo wp_json_encode($data); ?>;</script>
    <?php endif; ?>
    <?php echo $scripts; // phpcs:ignore WordPress.Security.EscapeOutput ?>
</body>
</html>
<?php
    }

    private function script_tag($rel) {
        return '<script src="' . esc_url(CCSP_URL . $rel . '?ver=' . CCSP_VERSION) . '"></script>' . "\n";
    }
}
