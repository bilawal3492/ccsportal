<?php
namespace CCSPortal\Admin;

use CCSPortal\Install;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Admin menu + dashboard, and registrar for all Phase 1 CRUD controllers.
 */
class Menu {

    /** @var CentresController */    private $centres;
    /** @var PromotionsController */ private $promotions;
    /** @var ManagersController */   private $managers;
    /** @var BrandsController */     private $brands;
    /** @var AuditController */      private $audit;

    public function __construct() {
        $this->centres    = new CentresController();
        $this->promotions = new PromotionsController();
        $this->managers   = new ManagersController();
        $this->brands     = new BrandsController();
        $this->audit      = new AuditController();
    }

    public function register() {
        // Controllers register their own admin-post form handlers.
        $this->centres->register();
        $this->promotions->register();
        $this->managers->register();
        $this->brands->register();

        add_action('admin_menu', [$this, 'add_menu']);
        add_action('admin_enqueue_scripts', [$this, 'assets']);
    }

    public function add_menu() {
        add_menu_page('Centre CCS Portal', 'CCS Portal', 'ccsp_use_portal', 'ccs-portal', [$this, 'render_dashboard'], 'dashicons-building', 26);

        add_submenu_page('ccs-portal', 'Dashboard', 'Dashboard', 'ccsp_use_portal', 'ccs-portal', [$this, 'render_dashboard']);
        add_submenu_page('ccs-portal', 'Centres & Fees', 'Centres & Fees', CentresController::CAP_VIEW, CentresController::PAGE, [$this->centres, 'render']);
        add_submenu_page('ccs-portal', 'Promotions', 'Promotions', PromotionsController::CAP, PromotionsController::PAGE, [$this->promotions, 'render']);
        add_submenu_page('ccs-portal', 'Managers', 'Managers', ManagersController::CAP, ManagersController::PAGE, [$this->managers, 'render']);
        add_submenu_page('ccs-portal', 'Brands', 'Brands', BrandsController::CAP, BrandsController::PAGE, [$this->brands, 'render']);
        add_submenu_page('ccs-portal', 'Audit Log', 'Audit Log', AuditController::CAP, AuditController::PAGE, [$this->audit, 'render']);
    }

    public function assets($hook) {
        if (strpos($hook, 'ccs-portal') === false) {
            return;
        }
        wp_enqueue_style('ccsp-admin', CCSP_URL . 'assets/css/admin.css', [], CCSP_VERSION);
    }

    private function count($basename) {
        global $wpdb;
        $t = Install::table($basename);
        return (int) $wpdb->get_var("SELECT COUNT(*) FROM $t");
    }

    public function render_dashboard() {
        $engine_ok = class_exists(CCSP_ENGINE_CLASS);
        ?>
        <div class="wrap ccsp-wrap">
            <h1 class="ccsp-title">Centre CCS Portal <span class="ccsp-ver">v<?php echo esc_html(CCSP_VERSION); ?></span></h1>
            <p class="ccsp-sub">Internal subsidy &amp; fee estimation tool across all centres — reusing the certified CCS engine, so the maths matches the public calculator exactly.</p>
            <?php
            $page_id = (int) get_option('ccsp_portal_page_id');
            $app_id  = (int) get_option('ccsp_app_page_id');
            if (($page_id && get_post_status($page_id) === 'publish') || ($app_id && get_post_status($app_id) === 'publish')) : ?>
                <p>
                    <?php if ($page_id && get_post_status($page_id) === 'publish') : ?>
                        <a class="button button-primary button-hero" href="<?php echo esc_url(get_permalink($page_id)); ?>" target="_blank">Open the calculator →</a>
                    <?php endif; ?>
                    <?php if ($app_id && get_post_status($app_id) === 'publish') : ?>
                        <a class="button button-hero" href="<?php echo esc_url(get_permalink($app_id)); ?>" target="_blank">Open the portal app →</a>
                    <?php endif; ?>
                </p>
            <?php endif; ?>

            <div class="ccsp-stats">
                <div class="ccsp-stat"><span class="n"><?php echo esc_html($this->count('brands')); ?></span><span class="l">Brands</span></div>
                <div class="ccsp-stat"><span class="n"><?php echo esc_html($this->count('centres')); ?></span><span class="l">Centres</span></div>
                <div class="ccsp-stat"><span class="n"><?php echo esc_html($this->count('promotions')); ?></span><span class="l">Promotions</span></div>
                <div class="ccsp-stat"><span class="n"><?php echo esc_html($this->count('calculations')); ?></span><span class="l">Saved estimates</span></div>
            </div>

            <h2>System status</h2>
            <table class="ccsp-status widefat">
                <tbody>
                    <tr>
                        <td>Shared CCS engine</td>
                        <td>
                            <?php if ($engine_ok) : ?>
                                <span class="ccsp-badge ok">Connected</span> <code><?php echo esc_html(CCSP_ENGINE_CLASS); ?></code>
                            <?php else : ?>
                                <span class="ccsp-badge bad">Not found</span> — activate <em>The Child Care Subsidy Calculator</em> plugin.
                            <?php endif; ?>
                        </td>
                    </tr>
                    <tr><td>Database schema</td><td><span class="ccsp-badge ok">v<?php echo esc_html(get_option('ccsp_db_version', '—')); ?></span> — <?php echo count(Install::TABLES); ?> tables installed</td></tr>
                    <tr><td>Centre Manager role</td><td><?php echo get_role(Install::ROLE_MANAGER) ? '<span class="ccsp-badge ok">Registered</span>' : '<span class="ccsp-badge bad">Missing</span>'; ?></td></tr>
                </tbody>
            </table>

            <h2>Build progress</h2>
            <ol class="ccsp-roadmap">
                <li class="done"><strong>Phase 0 — Foundation</strong> · plugin, database, roles, seeded data, engine wiring</li>
                <li class="done"><strong>Phase 1 — Admin CRUD</strong> · centres, fees, promotions, managers, brands + audit log</li>
                <li><strong>Phase 2 — Calculator</strong> · one-screen manager app computing CCS via the shared engine over REST</li>
                <li><strong>Phase 3 — Outputs</strong> · branded email + server-rendered PDF estimates</li>
                <li><strong>Phase 4 — Reporting</strong> · leads, promotions used, revenue, conversion</li>
            </ol>
        </div>
        <?php
    }
}
