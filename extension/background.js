const FOLIO = "https://folio-read-later-eleco.eric-leconte150114.chatgpt.site";
chrome.action.onClicked.addListener(async(tab)=>{
 if(!tab.url || !/^https?:\/\//i.test(tab.url)){await chrome.action.setBadgeText({text:'!'});setTimeout(()=>chrome.action.setBadgeText({text:''}),2500);return;}
 const params=new URLSearchParams({save:'1',url:tab.url,title:tab.title||''});
 await chrome.windows.create({url:FOLIO+'/?'+params,type:'popup',width:530,height:580});
});
