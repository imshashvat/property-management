'use client';

import { useEffect, useState, useCallback } from 'react';
import { Wrench, Search, X } from 'lucide-react';
import Toast from '@/components/Toast';

interface MReq {
  id:string;title:string;description:string;category:string;priority:string;status:string;
  resolution:string|null;createdAt:string;resolvedAt:string|null;
  tenant:{firstName:string;lastName:string;credentialId:string};
  flat:{flatNumber:string;property:{name:string}};
}

export default function MaintenancePage() {
  const [requests, setRequests] = useState<MReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState<MReq|null>(null);
  const [resolution, setResolution] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [toast, setToast] = useState<{message:string;type:'success'|'error'}|null>(null);

  const loadData = useCallback(async () => {
    const res = await fetch('/api/maintenance');
    const d = await res.json();
    if(d.success) setRequests(d.data);
    setLoading(false);
  },[]);

  useEffect(()=>{loadData();},[loadData]);

  const handleUpdate = async (e:React.FormEvent) => {
    e.preventDefault();
    if(!showModal) return;
    const body: Record<string,string> = {id:showModal.id};
    if(newStatus) body.status = newStatus;
    if(resolution) body.resolution = resolution;
    const res = await fetch('/api/maintenance',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d = await res.json();
    if(d.success){setToast({message:'Request updated!',type:'success'});setShowModal(null);loadData();}
    else setToast({message:d.error,type:'error'});
  };

  const filtered = requests.filter(r=>{
    const ms = !filterStatus||r.status===filterStatus;
    const mp = !filterPriority||r.priority===filterPriority;
    const mt = r.title.toLowerCase().includes(search.toLowerCase())||`${r.tenant.firstName} ${r.tenant.lastName}`.toLowerCase().includes(search.toLowerCase());
    return ms&&mp&&mt;
  });

  const pBadge = (p:string) => ({LOW:'badge-gray',MEDIUM:'badge-blue',HIGH:'badge-yellow',URGENT:'badge-red'}[p]||'badge-gray');
  const sBadge = (s:string) => ({OPEN:'badge-blue',IN_PROGRESS:'badge-yellow',RESOLVED:'badge-green',CLOSED:'badge-gray',REJECTED:'badge-red'}[s]||'badge-gray');

  return (
    <div>
      <div className="page-header"><h1>Maintenance</h1><p>Track and resolve maintenance requests</p></div>
      <div className="page-body">
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="search-input"><Search size={18}/><input className="form-input" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:38}}/></div>
            <select className="form-select filter-select" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="OPEN">Open</option><option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option>
            </select>
            <select className="form-select filter-select" value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}>
              <option value="">All Priority</option>
              <option value="LOW">Low</option><option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option><option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        {loading?<div className="skeleton" style={{height:300,borderRadius:'var(--radius-lg)'}}/>:filtered.length===0?
          <div className="empty-state"><Wrench/><h3>No requests</h3><p>All clear!</p></div>:(
          <div className="table-wrapper"><table className="table"><thead><tr><th>Request</th><th>Tenant</th><th>Flat</th><th>Category</th><th>Priority</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
            {filtered.map(r=><tr key={r.id}>
              <td><div style={{fontWeight:600,fontSize:'0.9rem'}}>{r.title}</div><div style={{fontSize:'0.75rem',color:'var(--text-tertiary)',maxWidth:200}} className="truncate">{r.description}</div></td>
              <td style={{fontSize:'0.85rem'}}>{r.tenant.firstName} {r.tenant.lastName}</td>
              <td style={{fontSize:'0.85rem'}}>{r.flat.flatNumber}<div style={{fontSize:'0.72rem',color:'var(--text-tertiary)'}}>{r.flat.property.name}</div></td>
              <td><span className="badge badge-purple">{r.category}</span></td>
              <td><span className={`badge ${pBadge(r.priority)}`}>{r.priority}</span></td>
              <td><span className={`badge ${sBadge(r.status)}`}>{r.status.replace('_',' ')}</span></td>
              <td style={{fontSize:'0.82rem',color:'var(--text-secondary)'}}>{new Date(r.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</td>
              <td>{r.status!=='RESOLVED'&&r.status!=='CLOSED'&&<button className="btn btn-ghost btn-sm" onClick={()=>{setNewStatus('');setResolution(r.resolution||'');setShowModal(r);}} style={{fontSize:'0.78rem'}}>Update</button>}</td>
            </tr>)}
          </tbody></table></div>
        )}
      </div>

      {showModal&&<div className="modal-overlay" onClick={()=>setShowModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><h2 className="modal-title">Update Request</h2><button className="modal-close" onClick={()=>setShowModal(null)}><X size={20}/></button></div>
        <form onSubmit={handleUpdate}><div className="modal-body">
          <div style={{padding:'12px 16px',background:'var(--bg-secondary)',borderRadius:'var(--radius-md)',marginBottom:16,border:'1px solid var(--border-primary)'}}>
            <div style={{fontWeight:600}}>{showModal.title}</div>
            <div style={{fontSize:'0.85rem',color:'var(--text-secondary)',marginTop:4}}>{showModal.description}</div>
            <div style={{display:'flex',gap:8,marginTop:8}}><span className={`badge ${pBadge(showModal.priority)}`}>{showModal.priority}</span><span className={`badge ${sBadge(showModal.status)}`}>{showModal.status.replace('_',' ')}</span></div>
          </div>
          <div className="form-group"><label className="form-label">Update Status</label><select className="form-select" value={newStatus} onChange={e=>setNewStatus(e.target.value)}>
            <option value="">No change</option><option value="IN_PROGRESS">In Progress</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option><option value="REJECTED">Rejected</option>
          </select></div>
          <div className="form-group"><label className="form-label">Resolution Notes</label><textarea className="form-textarea" value={resolution} onChange={e=>setResolution(e.target.value)} rows={3} placeholder="Describe the resolution..."/></div>
        </div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={()=>setShowModal(null)}>Cancel</button><button type="submit" className="btn btn-primary">Update</button></div></form>
      </div></div>}

      {toast&&<Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );
}
