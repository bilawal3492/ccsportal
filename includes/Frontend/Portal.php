<?php
namespace CCSPortal\Frontend;

use CCSPortal\Data\Repo;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Front-end portal: a login-gated one-screen calculator rendered by the
 * [ccs_portal] shortcode. Managers work here without ever seeing wp-admin.
 */
class Portal {

    const SHORTCODE = 'ccs_portal';

    public function register() {
        add_shortcode(self::SHORTCODE, [$this, 'render']);
        add_action('wp_enqueue_scripts', [$this, 'maybe_enqueue']);
    }

    /** Enqueue + localise only on pages that actually use the shortcode. */
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

        wp_enqueue_style('ccsp-portal', CCSP_URL . 'assets/css/portal.css', [], CCSP_VERSION);
        wp_enqueue_script('ccsp-portal', CCSP_URL . 'assets/js/portal.js', [], CCSP_VERSION, true);

        $centres = [];
        foreach (Repo::accessible_centres() as $c) {
            $centres[] = Repo::centre_bootstrap($c);
        }

        wp_localize_script('ccsp-portal', 'CCSP_PORTAL', [
            'root'     => esc_url_raw(rest_url('ccsp/v1/')),
            'nonce'    => wp_create_nonce('wp_rest'),
            'centres'  => $centres,
            'user'     => wp_get_current_user()->display_name,
            'engineOk' => class_exists(CCSP_ENGINE_CLASS),
        ]);
    }

    public function render() {
        if (!is_user_logged_in()) {
            return $this->gate(
                'Staff sign-in required',
                'This tool is for centre staff. Please sign in to continue.',
                wp_login_form(['echo' => false, 'redirect' => get_permalink()])
            );
        }
        if (!current_user_can('ccsp_use_portal')) {
            return $this->gate(
                'No portal access',
                'Your account is not set up to use the CCS Portal. Please contact your administrator.',
                ''
            );
        }
        if (empty(Repo::accessible_centres())) {
            return $this->gate(
                'No centre assigned',
                'You have portal access but no centre is assigned to your account yet. Please contact your administrator.',
                ''
            );
        }
        return $this->shell();
    }

    private function gate($title, $msg, $extra) {
        ob_start(); ?>
        <div class="ccsp-portal ccsp-gate">
            <div class="ccsp-gate-card">
                <h2><?php echo esc_html($title); ?></h2>
                <p><?php echo esc_html($msg); ?></p>
                <?php echo $extra; // phpcs:ignore WordPress.Security.EscapeOutput ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /** The one-screen 3-panel application shell. JS wires up the behaviour. */
    public function shell() {
        ob_start(); ?>
        <div class="ccsp-portal" id="ccsp-app">
            <header class="ccsp-appbar">
                <div class="ccsp-brandmark"><span class="ccsp-logo" id="ccsp-brand-dot"></span>
                    <div><strong id="ccsp-centre-title">CCS Portal</strong><span id="ccsp-brand-name">Select a centre</span></div>
                </div>
                <label class="ccsp-centre-picker">Centre
                    <select id="ccsp-centre"></select>
                </label>
            </header>

            <div class="ccsp-panels">
                <!-- LEFT: family & children -->
                <section class="ccsp-panel">
                    <h3 class="ccsp-panel-h">Family</h3>
                    <label class="fld">Parent name<input type="text" id="p_name" placeholder="Full name"></label>
                    <div class="fld-row">
                        <label class="fld">Email<input type="email" id="p_email" placeholder="name@email.com"></label>
                        <label class="fld">Phone<input type="tel" id="p_phone" placeholder="Mobile"></label>
                    </div>
                    <div class="fld-row">
                        <label class="fld">Enrolment status
                            <select id="enrol_status">
                                <option value="new">New enrolment</option>
                                <option value="existing">Existing family</option>
                                <option value="other">With another provider</option>
                            </select>
                        </label>
                        <label class="fld">Start date<input type="date" id="start_date"></label>
                    </div>

                    <h3 class="ccsp-panel-h mt">Children</h3>
                    <div id="ccsp-children"></div>
                    <button type="button" class="ccsp-add" id="ccsp-add-child">+ Add another child</button>
                </section>

                <!-- CENTRE: subsidy, attendance, promotion -->
                <section class="ccsp-panel">
                    <h3 class="ccsp-panel-h">Subsidy details</h3>
                    <label class="fld">Do you know your CCS %?
                        <select id="knows_ccs"><option value="0">No, estimate from income</option><option value="1">Yes, I know it</option></select>
                    </label>
                    <label class="fld" id="income_wrap">Combined family income (annual)
                        <input type="number" id="income" min="0" step="1000" placeholder="$">
                    </label>
                    <div class="fld-row hidden" id="known_wrap">
                        <label class="fld">Standard CCS % (first child)<input type="number" id="known_pct" min="0" max="90" step="0.01" placeholder="%"></label>
                        <label class="fld">Higher CCS % (additional)<input type="number" id="higher_display" min="0" max="95" step="0.01" placeholder="auto" readonly></label>
                    </div>
                    <div class="fld-row">
                        <label class="fld">Activity hours / fortnight
                            <select id="activity">
                                <option value="49">More than 48 hours</option>
                                <option value="0" selected>48 hours or less</option>
                            </select>
                        </label>
                        <label class="fld">CCS withholding
                            <select id="withholding">
                                <option value="5" selected>5%</option>
                                <option value="4">4%</option>
                                <option value="3">3%</option>
                                <option value="2">2%</option>
                                <option value="1">1%</option>
                                <option value="0">0%</option>
                            </select>
                        </label>
                    </div>
                    <label class="fld ccsp-toggle">First Nations child<input type="checkbox" id="is_atsi"></label>
                    <p class="ccsp-hint">3-Day Guarantee: from Jan 2026, all eligible families receive at least 72 hours (3 days) of subsidised care per fortnight, regardless of activity level.</p>

                    <h3 class="ccsp-panel-h mt">Fee basis</h3>
                    <label class="fld">Rate applied
                        <select id="rate_basis">
                            <option value="standard">Standard daily (with day-tier discount)</option>
                            <option value="weekly">Weekly rate</option>
                            <option value="windback">WindBack rate</option>
                        </select>
                    </label>

                    <h3 class="ccsp-panel-h mt">Promotion</h3>
                    <label class="fld">Offer applied
                        <select id="promotion"><option value="0">None</option></select>
                    </label>
                    <p class="ccsp-hint" id="promo-hint"></p>
                    <details class="ccsp-promo-terms hidden" id="promo-terms-wrap"><summary>Terms &amp; conditions</summary><div id="promo-terms"></div></details>
                </section>

                <!-- RIGHT: sticky live summary -->
                <aside class="ccsp-panel ccsp-summary" id="ccsp-summary-panel">
                    <div class="ccsp-sum-head">
                        <span>Live estimate</span>
                        <select id="period" class="ccsp-period">
                            <option value="week">per week</option>
                            <option value="fortnight">per fortnight</option>
                            <option value="month">per month</option>
                            <option value="year">per year</option>
                        </select>
                    </div>

                    <div class="ccsp-figure">
                        <span class="lab">Gross fee</span><span class="val" id="sum_fee">$0.00</span>
                    </div>
                    <div class="ccsp-figure good">
                        <span class="lab">CCS subsidy</span><span class="val" id="sum_sub">−$0.00</span>
                    </div>
                    <div class="ccsp-figure promo hidden" id="sum_promo_row">
                        <span class="lab" id="sum_promo_lab">Promotion</span><span class="val" id="sum_promo">−$0.00</span>
                    </div>
                    <div class="ccsp-figure total">
                        <span class="lab">Out of pocket</span><span class="val" id="sum_net">$0.00</span>
                    </div>

                    <div class="ccsp-chips">
                        <span class="chip">CCS <b id="sum_pct">0%</b></span>
                        <span class="chip"><b id="sum_hours">72</b> hrs/ftn</span>
                        <span class="chip" id="sum_promo_chip" style="display:none">Promo value <b id="sum_promo_total">$0</b></span>
                    </div>

                    <details class="ccsp-breakdown"><summary>Per-child breakdown</summary>
                        <div id="sum_children"></div>
                    </details>

                    <div class="ccsp-actions">
                        <button type="button" class="ccsp-btn primary" id="ccsp-save">Save estimate</button>
                        <button type="button" class="ccsp-btn" id="ccsp-print" disabled title="Coming in Phase 3">Print</button>
                        <button type="button" class="ccsp-btn" id="ccsp-email" disabled title="Coming in Phase 3">Email</button>
                    </div>
                    <p class="ccsp-savemsg" id="ccsp-savemsg"></p>
                    <p class="ccsp-disclaimer">Estimate only. Final CCS entitlement is determined by Services Australia.</p>
                </aside>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}
