<?php
/**
 * Plugin Name: Centre CCS Portal
 * Description: Internal CCS administration portal for Centre Managers — centre fees, subsidy estimates, promotions, and branded estimates across all centres. Reuses the CCS engine from The Child Care Subsidy Calculator (single source of truth, no duplicated logic).
 * Version: 0.10.0
 * Author: i9 Education
 * Author URI: https://i9.edu.au/
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: ccs-centre-portal
 * Requires at least: 5.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

// Runtime PHP guard.
if (version_compare(PHP_VERSION, '7.4', '<')) {
    add_action('admin_notices', function () {
        echo '<div class="notice notice-error"><p><strong>Centre CCS Portal:</strong> requires PHP 7.4 or higher. You are running PHP ' . esc_html(PHP_VERSION) . '.</p></div>';
    });
    return;
}

// Paths & version.
if (!defined('CCSP_VERSION'))  define('CCSP_VERSION', '0.10.0');
if (!defined('CCSP_DIR'))      define('CCSP_DIR', plugin_dir_path(__FILE__));
if (!defined('CCSP_URL'))      define('CCSP_URL', plugin_dir_url(__FILE__));
if (!defined('CCSP_DB_VERSION')) define('CCSP_DB_VERSION', '5');

// Fully-qualified name of the shared CCS engine provided by the calculator plugin.
if (!defined('CCSP_ENGINE_CLASS')) {
    define('CCSP_ENGINE_CLASS', 'CCSCalculator\\Includes\\Calculator\\CCSEngine');
}

// Manual requires (mirrors the calculator plugin's style — no autoloader).
require_once CCSP_DIR . 'includes/Install.php';
require_once CCSP_DIR . 'includes/Data/Repo.php';
require_once CCSP_DIR . 'includes/Admin/UI.php';
require_once CCSP_DIR . 'includes/Admin/Audit.php';
require_once CCSP_DIR . 'includes/Admin/CentresController.php';
require_once CCSP_DIR . 'includes/Admin/PromotionsController.php';
require_once CCSP_DIR . 'includes/Admin/ManagersController.php';
require_once CCSP_DIR . 'includes/Admin/BrandsController.php';
require_once CCSP_DIR . 'includes/Admin/AuditController.php';
require_once CCSP_DIR . 'includes/Admin/Menu.php';
require_once CCSP_DIR . 'includes/Rest/Api.php';
require_once CCSP_DIR . 'includes/Rest/AppApi.php';
require_once CCSP_DIR . 'includes/Rest/AdminApi.php';
require_once CCSP_DIR . 'includes/Rest/Auth.php';
require_once CCSP_DIR . 'includes/Frontend/Portal.php';
require_once CCSP_DIR . 'includes/Frontend/PortalApp.php';
require_once CCSP_DIR . 'includes/Frontend/FullScreen.php';

// Activation: create tables, seed data, register roles.
register_activation_hook(__FILE__, ['CCSPortal\\Install', 'activate']);

// Deactivation: keep all data; only tidy up scheduled events (none yet).
register_deactivation_hook(__FILE__, ['CCSPortal\\Install', 'deactivate']);

// Run lightweight migrations if the plugin was updated without re-activating.
// Must run on admin_init (not plugins_loaded): the migration can call
// wp_insert_post(), which relies on pluggable functions that are not defined
// until after plugins_loaded. Running earlier would fatally crash the site.
add_action('admin_init', ['CCSPortal\\Install', 'maybe_upgrade']);

// Warn (but do not fatally break) if the shared CCS engine is unavailable.
add_action('admin_notices', function () {
    if (!current_user_can('activate_plugins')) {
        return;
    }
    if (!class_exists(CCSP_ENGINE_CLASS)) {
        echo '<div class="notice notice-warning"><p><strong>Centre CCS Portal:</strong> the CCS calculation engine was not found. '
            . 'Please make sure <em>The Child Care Subsidy Calculator</em> plugin is installed and active — the portal reuses its engine so the subsidy maths stays identical everywhere.</p></div>';
    }
});

// Bootstrap admin UI, REST API and the front-end portal.
add_action('init', function () {
    $menu = new CCSPortal\Admin\Menu();
    $menu->register();

    $portal = new CCSPortal\Frontend\Portal();
    $portal->register();

    $portal_app = new CCSPortal\Frontend\PortalApp();
    $portal_app->register();

    $fullscreen = new CCSPortal\Frontend\FullScreen();
    $fullscreen->register();
});

// REST routes register on their own hook.
add_action('rest_api_init', function () {
    $api = new CCSPortal\Rest\Api();
    $api->routes();

    $app_api = new CCSPortal\Rest\AppApi();
    $app_api->routes();

    $admin_api = new CCSPortal\Rest\AdminApi();
    $admin_api->routes();

    $auth = new CCSPortal\Rest\Auth();
    $auth->routes();
});
