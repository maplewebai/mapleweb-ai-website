// Cloudflare D1 persistence for synthetic task tracking only.
import {bad} from './security.mjs';
export function requireDb(env){if(!env.DB || typeof env.DB.prepare!=='function')throw bad('Staging D1 database is not configured',503);return env.DB;}
export async function project(db,id){return await db.prepare('SELECT * FROM projects WHERE id=?').bind(id).first();}
export async function saveProject(db,p){
  await db.prepare(`INSERT INTO projects(id,version,draft_html,qa_passed,revision_open,owner_approved,customer_approved,updated_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,draft_html=excluded.draft_html,
    qa_passed=excluded.qa_passed,revision_open=excluded.revision_open,owner_approved=excluded.owner_approved,
    customer_approved=excluded.customer_approved,updated_at=excluded.updated_at`)
    .bind(p.id,p.version,p.draft_html,p.qa_passed,p.revision_open,p.owner_approved,p.customer_approved,new Date().toISOString()).run();
}
export async function saveJob(db,job){
  await db.prepare('INSERT INTO jobs(id,project_id,role,action,input_json,result_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(job.id,job.projectId,job.role,job.action,JSON.stringify(job.input),JSON.stringify(job.result),new Date().toISOString()).run();
}
export async function fetchJob(db,id){return db.prepare('SELECT * FROM jobs WHERE id=?').bind(id).first();}
export async function listJobs(db){const rs=await db.prepare('SELECT id,project_id,role,action,created_at FROM jobs ORDER BY created_at DESC LIMIT 50').all();return rs.results||[];}
export async function audit(db,operation,detail){await db.prepare('INSERT INTO audit(operation,detail,created_at) VALUES(?,?,?)').bind(operation,detail,new Date().toISOString()).run();}
