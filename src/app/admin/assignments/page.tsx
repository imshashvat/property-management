'use client';

import { useEffect, useState, useCallback } from 'react';
import { Link2, Plus, Search, X } from 'lucide-react';
import Toast from '@/components/Toast';

interface Assignment {
  id: string; startDate: string; endDate: string | null; rentAmount: number;
  deposit: number; status: string; isActive: boolean;
  tenant: { id: string; firstName: string; lastName: string; credentialId: string };
  flat: { id: string; flatNumber: string; property: { id: string; name: string } };
}
interface Tenant { id: string; firstName: string; lastName: string; credentialId: string; }
interface Flat { id: string; flatNumber: string; status: string; rentAmount: number; depositAmount: number | null; property: { name: string } }

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{message:string;type:'success'|'error'}|null>(null);
  const [form, setForm] = useState({tenantId:'',flatId:'',startDate:'',endDate:'',rentAmount:'',deposit:''});

  const loadData = useCallback(async () => {
    const [aR,tR,fR] = await Promise.all([fetch('/api/assignments'),fetch('/api/tenants'),fetch('/api/flats')]);
    const [aD,tD,fD] = await Promise.all([aR.json(),tR.json(),fR.json()]);
    if(aD.success) setAssignments(aD.data);
    if(tD.success) setTenants(tD.data);
    if(fD.success) setFlats(fD.data.filter((f:Flat)=>f.status==='VACANT'));
    setLoading(false);
  },[]);

  useEffect(()=>{loadData();},[loadData]);

  const handleFlatSelect = (fid:string) => {
    const flat = flats.find(f=>f.id===fid);
    setForm({...form,flatId:fid,rentAmount:flat?String(flat.rentAmount):'',deposit:flat?.depositAmount?String(flat.depositAmount):''});
  };

  const handleSubmit = async (e:React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/assignments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
    const d = await res.json();
    if(d.success){setToast({message:'Assignment created!',type:'success'});setShowModal(false);loadData();}
    else setToast({message:d.error,type:'error'});
  };

  const handleTerminate = async (id:string) => {
    if(!confirm('Terminate this assignment?')) return;
    const res = await fetch('/api/assignments',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status:'TERMINATED'})});
    const d = await res.json();
    if(d.success){setToast({message:'Assignment terminated',type:'success'});loadData();}
  };

  const filtered = assignments.filter(a=>`${a.tenant.firstName} ${a.tenant.lastName}`.toLowerCase().includes(search.toLowerCase())||a.flat.flatNumber.toLowerCase().includes(search.toLowerCase()));
  const sBadge = (s:string) => ({ACTIVE:'badge-green',EXPIRED:'badge-yellow',TERMINATED:'badge-red'}[s]||'badge-gray');

  return (
    <div>
      <div className="page-header"><h1>Assignments</h1><p>Manage tenant-flat assignments</p></div>
      <div className="page-body">
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="search-input"><Search size={18}/><input className="form-input" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:38}}/></div>
          </div>
          <button className="btn btn-primary" onClick={()=>{setForm({tenantId:'',flatId:'',startDate:'',endDate:'',rentAmount:'',deposit:''});setShowModal(true);}}><Plus size={18}/> New Assignment</button>
        </div>
        {loading?<div className="skeleton" style={{height:300,borderRadius:'var(--radius-lg)'}}/>:filtered.length===0?<div className="empty-state"><Link2/><h3>No assignments</h3><p>Assign tenants to flats</p></div>:(
          <div className="table-wrapper"><table className="table"><thead><tr><th>Tenant</th><th>Flat</th><th>Property</th><th>Rent</th><th>Period</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {filtered.map(a=><tr key={a.id}>
              <td><div style={{fontWeight:600,fontSize:'0.9rem'}}>{a.tenant.firstName} {a.tenant.lastName}</div><div style={{fontSize:'0.72rem',color:'var(--text-tertiary)'}}>{a.tenant.credentialId}</div></td>
              <td style={{fontWeight:500}}>{a.flat.flatNumber}</td>
              <td style={{color:'var(--text-secondary)',fontSize:'0.85rem'}}>{a.flat.property.name}</td>
              <td style={{fontWeight:600}}>₹{a.rentAmount.toLocaleString('en-IN')}</td>
              <td style={{fontSize:'0.82rem'}}>{new Date(a.startDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}{a.endDate?` — ${new Date(a.endDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`:''}</td>
              <td><span className={`badge ${sBadge(a.status)}`}>{a.status}</span></td>
              <td>{a.isActive&&<button className="btn btn-ghost btn-sm" onClick={()=>handleTerminate(a.id)} style={{color:'var(--danger-500)',fontSize:'0.78rem'}}>Terminate</button>}</td>
            </tr>)}
          </tbody></table></div>
        )}
      </div>
      {showModal&&<div className="modal-overlay" onClick={()=>setShowModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><h2 className="modal-title">New Assignment</h2><button className="modal-close" onClick={()=>setShowModal(false)}><X size={20}/></button></div>
        <form onSubmit={handleSubmit}><div className="modal-body">
          <div className="form-group"><label className="form-label">Tenant <span className="required">*</span></label><select className="form-select" value={form.tenantId} onChange={e=>setForm({...form,tenantId:e.target.value})} required><option value="">Select Tenant</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.credentialId})</option>)}</select></div>
          <div className="form-group"><label className="form-label">Flat (Vacant) <span className="required">*</span></label><select className="form-select" value={form.flatId} onChange={e=>handleFlatSelect(e.target.value)} required><option value="">Select Flat</option>{flats.map(f=><option key={f.id} value={f.id}>{f.flatNumber} - {f.property.name}</option>)}</select></div>
          <div className="form-row"><div className="form-group"><label className="form-label">Start Date <span className="required">*</span></label><input type="date" className="form-input" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} required/></div><div className="form-group"><label className="form-label">End Date</label><input type="date" className="form-input" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></div></div>
          <div className="form-row"><div className="form-group"><label className="form-label">Rent <span className="required">*</span></label><input type="number" className="form-input" value={form.rentAmount} onChange={e=>setForm({...form,rentAmount:e.target.value})} required/></div><div className="form-group"><label className="form-label">Deposit</label><input type="number" className="form-input" value={form.deposit} onChange={e=>setForm({...form,deposit:e.target.value})}/></div></div>
        </div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Create</button></div></form>
      </div></div>}
      {toast&&<Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );
}
