<?php
namespace CCSPortal\Admin;

use CCSPortal\Install;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Append-only audit trail for pricing / promotion / centre / manager changes.
 */
class Audit {

    /**
     * Record an action.
     *
     * @param string     $entity  e.g. 'centre', 'fee_schedule', 'promotion', 'manager'
     * @param int        $id      entity primary key (or 0)
     * @param string     $action  'create' | 'update' | 'delete' | 'assign'
     * @param array|null $before  state before the change
     * @param array|null $after   state after the change
     */
    public static function log($entity, $id, $action, $before = null, $after = null) {
        global $wpdb;
        $wpdb->insert(Install::table('audit_log'), [
            'user_id'     => get_current_user_id(),
            'entity'      => $entity,
            'entity_id'   => (int) $id,
            'action'      => $action,
            'before_json' => $before === null ? null : wp_json_encode($before),
            'after_json'  => $after === null ? null : wp_json_encode($after),
            'created_at'  => current_time('mysql'),
        ]);
    }

    /** Recent audit rows with the actor's display name. */
    public static function recent($limit = 100) {
        global $wpdb;
        $t = Install::table('audit_log');
        $limit = max(1, (int) $limit);
        return $wpdb->get_results(
            "SELECT a.*, u.display_name
             FROM $t a LEFT JOIN {$wpdb->users} u ON u.ID = a.user_id
             ORDER BY a.id DESC LIMIT $limit"
        );
    }

    /**
     * Filtered, paginated query for the in-portal activity log.
     * @param array $args entity, action, user_id, search, limit, offset
     * @return array{rows: array, total: int}
     */
    public static function query($args = []) {
        global $wpdb;
        $t = Install::table('audit_log');
        $where = ['1=1'];
        $params = [];
        if (!empty($args['entity']))  { $where[] = 'a.entity = %s'; $params[] = $args['entity']; }
        if (!empty($args['action']))  { $where[] = 'a.action = %s'; $params[] = $args['action']; }
        if (!empty($args['user_id'])) { $where[] = 'a.user_id = %d'; $params[] = (int) $args['user_id']; }
        if (!empty($args['search'])) {
            $like = '%' . $wpdb->esc_like($args['search']) . '%';
            $where[] = '(u.display_name LIKE %s OR a.entity LIKE %s OR a.action LIKE %s)';
            $params[] = $like; $params[] = $like; $params[] = $like;
        }
        $wsql = implode(' AND ', $where);
        $limit  = min(1000, max(1, (int) ($args['limit'] ?? 200)));
        $offset = max(0, (int) ($args['offset'] ?? 0));

        $csql = "SELECT COUNT(*) FROM $t a LEFT JOIN {$wpdb->users} u ON u.ID = a.user_id WHERE $wsql";
        $total = (int) ($params ? $wpdb->get_var($wpdb->prepare($csql, $params)) : $wpdb->get_var($csql));

        $sql = "SELECT a.*, u.display_name FROM $t a LEFT JOIN {$wpdb->users} u ON u.ID = a.user_id WHERE $wsql ORDER BY a.id DESC LIMIT %d OFFSET %d";
        $rows = $wpdb->get_results($wpdb->prepare($sql, array_merge($params, [$limit, $offset])));
        return ['rows' => $rows ?: [], 'total' => $total];
    }

    /** Distinct values of a column ('entity' | 'action') for filter dropdowns. */
    public static function distinct($col) {
        global $wpdb;
        $t = Install::table('audit_log');
        $col = in_array($col, ['entity', 'action'], true) ? $col : 'entity';
        return $wpdb->get_col("SELECT DISTINCT $col FROM $t ORDER BY $col ASC");
    }

    /** Users who have any audit entries, for the actor filter. */
    public static function actors() {
        global $wpdb;
        $t = Install::table('audit_log');
        return $wpdb->get_results(
            "SELECT a.user_id, u.display_name FROM $t a LEFT JOIN {$wpdb->users} u ON u.ID = a.user_id
             GROUP BY a.user_id ORDER BY u.display_name ASC"
        );
    }

    /** Short human summary of what changed / what happened. */
    public static function summary($row) {
        $after  = isset($row->after_json)  && $row->after_json  ? json_decode($row->after_json, true)  : null;
        if (!is_array($after)) { return ''; }
        $bits = [];
        foreach (['name', 'subject', 'scenario', 'status', 'role', 'email', 'full_daily_fee', 'weekly_rate', 'windback_rate', 'value', 'severity', 'centres', 'changed'] as $k) {
            if (isset($after[$k]) && $after[$k] !== '' && $after[$k] !== null) {
                $v = is_array($after[$k]) ? implode(', ', $after[$k]) : $after[$k];
                $bits[] = $k . ': ' . $v;
            }
        }
        return implode(' · ', array_slice($bits, 0, 6));
    }
}
