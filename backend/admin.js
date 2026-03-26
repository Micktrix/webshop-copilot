import pool from './db.js';
import { hentAggregeredeStats } from './events.js';

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'skift-mig';

const PLAN_PRISER = { gratis: 0, pro: 299 };

function erChurned(shop) {
  const grænse = new Date();
  grænse.setDate(grænse.getDate() - 30);
  const sidst = shop.sidst_aktiv || shop.oprettet;
  return sidst ? new Date(sidst) < grænse : false;
}

export function requireAdmin(req, res, next) {
  const auth = req.headers['x-admin-token'];
  const expected = Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');
  if (auth !== expected) return res.status(401).json({ error: 'Ingen adgang' });
  next();
}

export function registerAdminRoutes(app) {
  app.post('/admin/login', (req, res) => {
    const { user, pass } = req.body;
    if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
      return res.status(401).json({ error: 'Forkert brugernavn eller adgangskode' });
    }
    const token = Buffer.from(`${user}:${pass}`).toString('base64');
    res.json({ token });
  });

  app.get('/admin/shops', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT email, plan, aktiv, demo, branche, oprettet, sidst_aktiv
         FROM shops ORDER BY oprettet DESC`
      );
      const liste = result.rows.map(s => ({
        email:      s.email,
        plan:       s.plan,
        aktiv:      s.aktiv,
        demo:       s.demo,
        churned:    erChurned(s),
        oprettet:   s.oprettet,
        sidstAktiv: s.sidst_aktiv,
        branche:    s.branche
      }));
      res.json(liste);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/admin/shops/:email', requireAdmin, async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email);
      const { plan, aktiv, branche, demo } = req.body;
      await pool.query(
        `UPDATE shops SET
           plan    = COALESCE($1, plan),
           aktiv   = COALESCE($2, aktiv),
           branche = COALESCE($3, branche),
           demo    = COALESCE($4, demo)
         WHERE email = $5`,
        [plan ?? null, aktiv ?? null, branche ?? null, demo ?? null, email]
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/admin/shops/:email', requireAdmin, async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email);
      await pool.query('DELETE FROM shops WHERE email = $1', [email]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/admin/stats', requireAdmin, async (req, res) => {
    try {
      const [base, shopsResult] = await Promise.all([
        hentAggregeredeStats(),
        pool.query('SELECT plan, oprettet, sidst_aktiv FROM shops')
      ]);

      const shops = shopsResult.rows;
      const mrr = shops.reduce((sum, s) => sum + (PLAN_PRISER[s.plan] || 0), 0);

      const planFordeling = { gratis: 0, pro: 0, business: 0 };
      shops.forEach(s => { planFordeling[s.plan || 'gratis']++; });

      const churnedAntal = shops.filter(erChurned).length;

      res.json({ ...base, mrr, planFordeling, churnedAntal });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
