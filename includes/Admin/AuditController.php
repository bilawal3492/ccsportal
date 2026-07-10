<?php
namespace CCSPortal\Admin;

if (!defined('ABSPATH')) {
    exit;
}

/** Read-only audit log viewer. */
class AuditController {

    const PAGE = 'ccs-portal-audit';
    const CAP  = 'ccsp_manage_portal';

    public function render() {
        if (!current_user_can(self::CAP)) {
            wp_die('Access denied.');
        }
        $rows = Audit::recent(200);
        ?>
        <div class="wrap ccsp-wrap">
            <h1 class="ccsp-title">Audit Log</h1>
            <p class="ccsp-sub">Every change to centres, fees, promotions, brands and manager assignments, most recent first.</p>
            <table class="widefat striped ccsp-table">
                <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
                <tbody>
                <?php if (!$rows) : ?>
                    <tr><td colspan="5">No activity recorded yet.</td></tr>
                <?php endif; ?>
                <?php foreach ($rows as $r) : ?>
                    <tr>
                        <td><?php echo esc_html($r->created_at); ?></td>
                        <td><?php echo esc_html($r->display_name ?: ('#' . $r->user_id)); ?></td>
                        <td><span class="ccsp-badge <?php echo $r->action === 'delete' ? 'bad' : 'ok'; ?>"><?php echo esc_html(ucfirst($r->action)); ?></span></td>
                        <td><?php echo esc_html($r->entity); ?> <code>#<?php echo (int) $r->entity_id; ?></code></td>
                        <td class="ccsp-audit-detail"><?php echo esc_html($this->summarise($r)); ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php
    }

    /** Short human summary of what changed. */
    private function summarise($r) {
        $after = $r->after_json ? json_decode($r->after_json, true) : null;
        if (!is_array($after)) {
            return '';
        }
        $bits = [];
        foreach (['name', 'full_daily_fee', 'weekly_rate', 'windback_rate', 'status', 'value', 'centres'] as $k) {
            if (isset($after[$k])) {
                $v = is_array($after[$k]) ? implode(',', $after[$k]) : $after[$k];
                $bits[] = $k . '=' . $v;
            }
        }
        return implode(' · ', array_slice($bits, 0, 5));
    }
}
