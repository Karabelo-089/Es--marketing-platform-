
function startApp(){document.getElementById("hero").style.display="none";document.getElementById("overview").style.display="none";document.getElementById("workspace").style.display="block";window.scrollTo(0,0)}
function hidePanels(){["contentTool","analyticsPanel","campaignPanel"].forEach(id=>document.getElementById(id).style.display="none")}
function openContentTool(){hidePanels();document.getElementById("contentTool").style.display="block";document.getElementById("contentTool").scrollIntoView({behavior:"smooth"})}
function openAnalytics(){hidePanels();document.getElementById("analyticsPanel").style.display="block";document.getElementById("analyticsPanel").scrollIntoView({behavior:"smooth"})}
function openCampaigns(){hidePanels();document.getElementById("campaignPanel").style.display="block";document.getElementById("campaignPanel").scrollIntoView({behavior:"smooth"})}
function generateContent(){
 const branch=document.getElementById("branch").value, service=document.getElementById("service").value||"our services", audience=document.getElementById("audience").value||"customers in "+branch, platform=document.getElementById("platform").value, tone=document.getElementById("tone").value;
 document.getElementById("contentResult").textContent=`${tone} ${platform} post — ${branch}\n\nLooking for reliable ${service}? Electrical Suppliers is here to help.\n\nWe provide trusted electrical solutions for ${audience}. From electrical services and solar to air conditioning, ventilation and cameras, our team can help you find the right solution.\n\n📍 Serving ${branch}\n💬 Contact us on WhatsApp for a quote or enquiry.\n\n#ElectricalSuppliers #${branch.replace(/\s/g,"")} #${service.replace(/\s/g,"")}`;
}
function createCampaign(){
 const name=document.getElementById("campaignName").value||"New campaign",budget=document.getElementById("budget").value,goal=document.getElementById("goal").value,branch=document.getElementById("branch").value;
 document.getElementById("campaignResult").textContent=`Campaign: ${name}\nBranch: ${branch}\nDaily budget: R${budget}\nGoal: ${goal}\n\nNext step: connect this campaign to Meta Ads so it can be launched.`;
 document.getElementById("campaignCount").textContent="4";
}
function connectMeta() {
const status = document.getElementById("metaStatus");

status.innerHTML = `
<div class="connected">
✅ Meta connected
<br>
<small>Facebook + Instagram advertising accounts connected.</small>
</div>
`;

document.getElementById("step2").classList.add("complete");
document.getElementById("step3").style.display = "block";
}
function selectAdAccount() {
const account = document.getElementById("adAccount").value;
const status = document.getElementById("adAccountStatus");

if (!account) {
status.textContent = "Please select an ad account.";
return;
}

status.innerHTML = `
<div class="connected">
✅ Ad account selected
<br>
<small>${account}</small>
</div>
`;

document.getElementById("step3").classList.add("complete");
document.getElementById("step4").style.display = "block";
}
function reviewCampaign() {
const name = document.getElementById("campaignName").value || "New campaign";
const budget = document.getElementById("budget").value || "0";
const goal = document.getElementById("goal").value || "Not selected";
const account = document.getElementById("adAccount").value || "Not selected";

document.getElementById("campaignReview").innerHTML = `
<strong>Campaign ready for launch</strong>
<br><br>
Campaign: ${name}
<br>
Daily budget: R${budget}
<br>
Goal: ${goal}
<br>
Ad account: ${account}
<br><br>
<span>✅ Meta connected</span>
`;

document.getElementById("step4").classList.add("complete");
document.getElementById("step5").style.display = "block";
}
function launchCampaign() {
const status = document.getElementById("launchStatus");

status.innerHTML = `
<div class="connected">
🚀 Campaign launched successfully
<br>
<small>Your campaign has been sent to Meta.</small>
</div>
`;

document.getElementById("step5").classList.add("complete");
}