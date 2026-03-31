'use client';

import { useEffect, useState, useCallback } from 'react';
import { CreditCard, Search, X, Zap, CheckCircle } from 'lucide-react';
import Toast from '@/components/Toast';

interface Payment {
  id:string;amount:number;dueDate:string;paidDate:string|null;status:string;paymentMethod:string|null;
  month:number;year:number;lateFee:number;notes:string|null;
  tenant:{firstName:string;lastName:string;credentialId:string};
  flat:{flatNumber:string;property:{name:string}};
}

const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function RentPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [showPay, setShowPay] = useState<Payment|null>(null);
  const [genForm, setGenForm] = useState({month:String(new Date().getMonth()+1),year:String(new Date().getFullYear())});
  const [payForm, setPayForm] = useState({paymentMethod:'',transactionId:'',notes:''});
  const [toast, setToast] = useState<{message:string;type:'success'|'error'|'info'}|null>(null);

  const loadData = useCallback(async () => {
    const res = await fetch('/api/rent');
    const d = await res.json();
    if(d.success) setPayments(d.data);
    setLoading(false);
  },[]);

  useEffect(()=>{loadData();},[loadData]);

  const handleGenerate = async (e:React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/rent',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(genForm)});
    const d = await res.json();
    if(d.success){setToast({message:`Generated ${d.data.created} records (${d.data.skipped} skipped)`,type:'success'});setShowGenerate(false);loadData();}
    else setToast({message:d.error,type:'error'});
  };

  const handleMarkPaid = async (e:React.FormEvent) => {
    e.preventDefault();
    if(!showPay) return;
    const res = await fetch('/api/rent',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:showPay.id,status:'PAID',...payForm})});
    const d = await res.json();
    if(d.success){setToast({message:'Payment recorded!',type:'success'});setShowPay(null);loadData();}
    else setToast({message:d.error,type:'error'});
  };

  const filtered = payments.filter(p=>{
    const ms = !filterStatus||p.status===filterStatus;
    const ms2 = `${p.tenant.firstName} ${p.tenant.lastName}`.toLowerCase().includes(search.toLowerCase())||p.flat.flatNumber.toLowerCase().includes(search.toLowerCase());
    return ms&&ms2;
  });

  const sBadge = (s:string) => ({PAID:'badge-green',PENDING:'badge-yellow',OVERDUE:'badge-red',PARTIALLY_PAID:'badge-blue'}[s]||'badge-gray');

  return (
    <div>
      <div className="page-header"><h1>Rent Management</h1><p>Track payments across all tenants</p></div>
      <div className="page-body">
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="search-input"><Search size={18}/><input className="form-input" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:38}}/></div>
            <select className="form-select filter-select" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={()=>setShowGenerate(true)}><Zap size={18}/> Generate Rent</button>
        </div>

        {loading?<div className="skeleton" style={{height:300,borderRadius:'var(--radius-lg)'}}/>:filtered.length===0?
          <div className="empty-state"><CreditCard/><h3>No payments</h3><p>Generate rent records first</p></div>:(
          <div className="table-wrapper"><table className="table"><thead><tr><th>Tenant</th><th>Flat</th><th>Period</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {filtered.map(p=><tr key={p.id}>
              <td><div style={{fontWeight:600,fontSize:'0.9rem'}}>{p.tenant.firstName} {p.tenant.lastName}</div><div style={{fontSize:'0.72rem',color:'var(--text-tertiary)'}}>{p.tenant.credentialId}</div></td>
              <td style={{fontSize:'0.85rem'}}>{p.flat.flatNumber}<div style={{fontSize:'0.72rem',color:'var(--text-tertiary)'}}>{p.flat.property.name}</div></td>
              <td style={{fontWeight:500}}>{MONTHS[p.month-1]} {p.year}</td>
              <td style={{fontWeight:700}}>₹{p.amount.toLocaleString('en-IN')}{p.lateFee>0&&<span style={{fontSize:'0.7rem',color:'var(--danger-500)'}}> +₹{p.lateFee}</span>}</td>
              <td style={{fontSize:'0.85rem'}}>{new Date(p.dueDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</td>
              <td><span className={`badge ${sBadge(p.status)}`}>{p.status}</span></td>
              <td>{p.status!=='PAID'&&<button className="btn btn-sm btn-primary" onClick={()=>{setPayForm({paymentMethod:'',transactionId:'',notes:''});setShowPay(p);}} style={{fontSize:'0.78rem'}}><CheckCircle size={14}/> Mark Paid</button>}</td>
            </tr>)}
          </tbody></table></div>
        )}
      </div>

      {showGenerate&&<div className="modal-overlay" onClick={()=>setShowGenerate(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><h2 className="modal-title">Generate Monthly Rent</h2><button className="modal-close" onClick={()=>setShowGenerate(false)}><X size={20}/></button></div>
        <form onSubmit={handleGenerate}><div className="modal-body">
          <p style={{marginBottom:16,color:'var(--text-secondary)',fontSize:'0.9rem'}}>This will create payment records for all active assignments.</p>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Month</label><select className="form-select" value={genForm.month} onChange={e=>setGenForm({...genForm,month:e.target.value})}>{MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Year</label><input type="number" className="form-input" value={genForm.year} onChange={e=>setGenForm({...genForm,year:e.target.value})}/></div>
          </div>
        </div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={()=>setShowGenerate(false)}>Cancel</button><button type="submit" className="btn btn-primary"><Zap size={16}/> Generate</button></div></form>
      </div></div>}

      {showPay&&<div className="modal-overlay" onClick={()=>setShowPay(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><h2 className="modal-title">Record Payment</h2><button className="modal-close" onClick={()=>setShowPay(null)}><X size={20}/></button></div>
        <form onSubmit={handleMarkPaid}><div className="modal-body">
          <div style={{padding:'12px 16px',background:'var(--bg-secondary)',borderRadius:'var(--radius-md)',marginBottom:16,border:'1px solid var(--border-primary)'}}>
            <div style={{fontSize:'0.85rem',fontWeight:600}}>{showPay.tenant.firstName} {showPay.tenant.lastName} — Flat {showPay.flat.flatNumber}</div>
            <div style={{fontSize:'1.2rem',fontWeight:800,marginTop:4}}>₹{showPay.amount.toLocaleString('en-IN')}</div>
            <div style={{fontSize:'0.75rem',color:'var(--text-tertiary)'}}>{MONTHS[showPay.month-1]} {showPay.year}</div>
          </div>
          <div className="form-group"><label className="form-label">Payment Method</label><select className="form-select" value={payForm.paymentMethod} onChange={e=>setPayForm({...payForm,paymentMethod:e.target.value})}><option value="">Select</option><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank Transfer</option><option value="UPI">UPI</option><option value="CHEQUE">Cheque</option></select></div>
          <div className="form-group"><label className="form-label">Transaction ID</label><input className="form-input" value={payForm.transactionId} onChange={e=>setPayForm({...payForm,transactionId:e.target.value})} placeholder="Optional"/></div>
          <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={payForm.notes} onChange={e=>setPayForm({...payForm,notes:e.target.value})} rows={2}/></div>
        </div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={()=>setShowPay(null)}>Cancel</button><button type="submit" className="btn btn-primary"><CheckCircle size={16}/> Confirm Payment</button></div></form>
      </div></div>}

      {toast&&<Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );
}
