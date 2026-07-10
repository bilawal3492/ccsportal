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
}
