# Centre CCS Portal: Deployment Guide

## Where to host: a WordPress server (PHP + MySQL). NOT AWS Amplify.

This system is **WordPress**. Two PHP plugins run inside a WordPress install:

- **The Child Care Subsidy Calculator**: owns the CCS calculation engine
  (`CCSCalculator\Includes\Calculator\CCSEngine`) and the policy rates.
- **Centre CCS Portal**: depends on that engine; creates MySQL tables
  (`wp_ccsp_*`), WordPress roles, the REST API (`/wp-json/ccsp/v1/…`), and the
  front-end pages. Its React app is vendored (no build step) and served by
  WordPress, using WordPress login cookies + REST nonces (same-origin).

Because of this, the front-end and back-end must live on the **same WordPress
install on ccs.i9.edu.au**. AWS Amplify Hosting only runs static sites / JS SPAs
+ serverless, so it cannot run WordPress, PHP, or MySQL. Do not use Amplify.

### Hosting options (pick one)
- The **same host as i9.edu.au** (if WordPress): add the `ccs.i9.edu.au`
  subdomain → a new WordPress install. Simplest.
- **Managed WordPress**: Cloudways, Kinsta, WP Engine, SiteGround.
- **AWS done right**: Lightsail (1-click WordPress) or EC2 (LAMP) + RDS MySQL.

### Requirements
- PHP 7.4+, MySQL, WordPress 5.0+
- HTTPS / SSL (required for login + REST nonces)

## Deploy steps
1. Point `ccs.i9.edu.au` DNS at the server; install SSL (Let's Encrypt).
2. Install WordPress.
3. WordPress → Settings → Permalinks → **Post name** (pretty permalinks).
4. Plugins → Add New → Upload, then **activate both**:
   1. The Child Care Subsidy Calculator (engine), first.
   2. Centre CCS Portal, second.
5. On activation the portal auto-creates tables, roles, seed data, and pages:
   - `/centre-ccs-portal-app`: the SaaS app (staff URL)
   - `/centre-ccs-portal`: the calculator
6. CCS Calculator → Settings: set current income thresholds + hourly caps
   (2025-26 / 2026-27 legislated figures). The engine is exact; these values
   keep it compliant.
7. CCS Portal → Centres & fees / Promotions: enter each centre's real fees and
   offers.
8. CCS Portal → Users: create Centre Manager accounts.
9. Staff login URL: `https://ccs.i9.edu.au/centre-ccs-portal-app`

## Notes
- Deactivating the portal keeps all data (tables/roles/pages remain).
- Updating the plugin: upload the new zip over the old one; migrations run on
  the next admin page load.
- Everything is same-origin; there is no separate API host to configure.
