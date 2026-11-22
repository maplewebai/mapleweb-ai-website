// Kimi Build and Kimi API are different products. There is no verified
// programmatic Kimi Build/export connection for MapleWeb AI at present.
// This contract fails closed and cannot spend credits, transfer information,
// create live websites or call an unverified external endpoint.
const unavailable = () => {
  const error = new Error('KIMI_NOT_CONNECTED: A verified, owner-authorized Kimi integration is required');
  error.code='KIMI_NOT_CONNECTED';
  error.status=503;
  throw error;
};
const validVersion = n => Number.isSafeInteger(n) && n>0;
export function createKimiAdapter(){
  return Object.freeze({
    status(){
      return {provider:'Kimi',product:'Kimi Build (unverified API); Kimi API (separate)',
        connected:false,modelVerified:false,paidUsageAuthorized:false,
        canCreateDraft:false,canRequestRevision:false,canExport:false,
        customerDataTransferEnabled:false,publishingEnabled:false};
    },
    async createDraft(brief){
      if(!brief||typeof brief!=='object'||Array.isArray(brief) ||
        brief.synthetic!==true) throw new TypeError('Synthetic website brief required');
      unavailable();
    },
    async requestRevision(version,instructions){
      if(!validVersion(version)||typeof instructions!=='string'||
        !instructions.trim()||instructions.length>1000)
        throw new TypeError('Valid draft version and short instructions required');
      unavailable();
    },
    async getExport(version){
      if(!validVersion(version)) throw new TypeError('Valid draft version required');
      unavailable();
    },
    async estimateCost(){
      return {status:'UNKNOWN_NOT_AUTHORIZED',currency:'CAD',amount:null,
        credits:null,paidUsageAuthorized:false,estimated:false,
        note:'Check real Kimi Build/API pricing, credits and export support before authorizing usage'};
    }
  });
}
