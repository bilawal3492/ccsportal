# Centre CCS Portal

Internal WordPress plugin, a standalone SaaS-style admin for Centre Managers to
calculate Australian Child Care Subsidy (CCS) estimates, apply centre fees and
promotions, and present the best-value offer to parents across multiple brands
and centres.

- **Standalone React admin** (React 18 + htm, vendored, no build step) served
  full-screen by WordPress, with a **custom login / settings / logout**, so staff
  never touch wp-admin.
- **Reuses the certified CCS engine** from *The Child Care Subsidy Calculator*
  plugin (single source of truth, no duplicated subsidy maths).
- REST API under `ccsp/v1/*`, custom tables `wp_ccsp_*`, WordPress roles.

## Requirements
- WordPress 5.0+, PHP 7.4+, MySQL, HTTPS
- **The Child Care Subsidy Calculator** plugin active (provides the CCS engine)

## Install
Upload the plugin (or a build from `release/`) via Plugins → Add New → Upload,
activate, then set permalinks to *Post name*. See [DEPLOYMENT.md](DEPLOYMENT.md)
for full deployment steps (host on a WordPress server, not AWS Amplify).

## Structure
- `ccs-centre-portal.php`: bootstrap
- `includes/Rest/`: REST API (calculate, estimates, admin CRUD, auth)
- `includes/Frontend/`: full-screen renderer + shortcodes
- `includes/Admin/`: wp-admin fallback screens + audit log
- `includes/Data/`: data access
- `assets/`: React app (`js/app.js`), styles, vendored React
