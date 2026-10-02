type Account = { id:string; email?:string; confirmedAt?:string };
export async function verifyApprovedAccount(user:Account,allowed:string[],lookup:(id:string)=>Promise<Account>) {
 const email=(user.email||'').toLowerCase();
 if(!allowed.includes(email))throw new Response('This email has not been approved for the workspace.',{status:403});
 let account=user;
 if(!account.confirmedAt){
  try{account=await lookup(user.id);}catch{throw new Response('Could not verify your account. Please try again.',{status:503});}
 }
 if(account.id!==user.id||(account.email||'').toLowerCase()!==email)throw new Response('Could not verify your account. Please sign in again.',{status:403});
 if(!account.confirmedAt)throw new Response('Confirm your email using the invitation or confirmation email before signing in.',{status:403});
}
