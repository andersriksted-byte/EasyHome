// Kategorier til indkøbslisten – kopieret fra Madro, så forsiden sorterer som appen
const norm=s=>String(s||"").toLowerCase().replace(/[éèêë]/g,"e").replace(/[îïí]/g,"i").replace(/[àáâ]/g,"a").replace(/[ôóö]/g,"o").replace(/[üúû]/g,"u").replace(/[^a-zæøå0-9 ]+/g," ").replace(/\s+/g," ").trim();
const CATS=["Frugt & grønt","Brød & bager","Kød & fisk","Pålæg","Mejeri","Ost","Frost","Kolonial","Morgenmad","Snacks & slik","Drikkevarer","Vin & øl","Baby & børn","Husholdning","Personlig pleje","Apotek","Kæledyr","Andet"];
const CAT_EMO={"Frugt & grønt":"🥕","Brød & bager":"🥖","Kød & fisk":"🥩","Pålæg":"🥪","Mejeri":"🥛","Ost":"🧀","Frost":"❄️","Kolonial":"🫙","Morgenmad":"🥣","Snacks & slik":"🍫","Drikkevarer":"🥤","Vin & øl":"🍷","Baby & børn":"🍼","Husholdning":"🧻","Personlig pleje":"🧴","Apotek":"💊","Kæledyr":"🐾","Andet":"🛒","Øvrige":"🛒","Øvrige indkøb":"🛒","Fundet":"✓"};
/* old names from earlier versions of the app */
const CAT_OLD={"Brød":"Brød & bager","Mejeri & æg":"Mejeri","Krydderier & bagning":"Kolonial"};
// first matching rule wins; "=" means whole word only
const CAT_RULES=[
 ["Drikkevarer",["æblemost","=most"]],
 ["Snacks & slik",["pebernødder","chokoladekiks"]],
 ["Kolonial",["i tomat","hakkede tomater","flåede tomater","passata","tomatpuré","tomatpure","kokosmælk","tun i","makrel","sardiner","bouillon","dåse","kikærter","kidneybønner","sorte bønner","hvide bønner","linser","bønner i","majs på dåse","kartoffelmel","majsstivelse","maizena","chiliflager","chilipulver","chilisauce","sweet chili","sriracha","stødt","peberkorn","hvidløgspulver","løgpulver","sovsekulør","kulør","jævner"]],
 ["Baby & børn",["bleer","=ble","vådservietter","babygrød","grødpulver","modermælk","babymos","sutter","sut","sutteflaske","bleposer"]],
 ["Apotek",["plaster","hovedpine","panodil","pamol","ipren","treo","halstablet","halspastil","vitamin","multivitamin","næsespray","termometer","håndkøb","smertestillende","allergi","fiskeolie","omega"]],
 ["Kæledyr",["hundefoder","kattefoder","kattegrus","godbid","hundesnack","kattemad","hundemad","tyggeben"]],
 ["Husholdning",["toiletpapir","køkkenrulle","opvask","vaskemiddel","skyllemiddel","affaldsposer","frysepose","fryseposer","folie","husholdningsfilm","bagepapir","stearinlys","fyrfadslys","=lys","rengøring","klude","svamp","grydesvamp","pålægsposer","wc","toiletrens","kalkfjerner","tørretumbler","sølvpapir"]],
 ["Personlig pleje",["tandpasta","tandbørste","tandtråd","shampoo","balsam","sæbe","håndsæbe","bodylotion","deodorant","=deo","bind","tamponer","trusseindlæg","barberblade","barberskum","vatrondeller","vatpinde","hudcreme","solcreme","læbepomade"]],
 ["Frost",["frost","frosne","frossen","=is","flødeis","isvafler","pommes frites","pizza","fiskefileter frost"]],
 ["Pålæg",["leverpostej","postej","spegepølse","rullepølse","hamburgerryg","skinke","salami","pålæg","remoulade","sylte","kyllingepålæg","hønsesalat","italiensk salat","tunsalat","rejesalat","pålægssalat","hummus"]],
 ["Ost",["=ost","feta","mozzarella","parmesan","cheddar","brie","camembert","gouda","danbo","havarti","mascarpone","ricotta","halloumi","burrata","rygeost","hytteost","smøreost"]],
 ["Morgenmad",["havregryn","müsli","musli","granola","cornflakes","havrefras","=fras","morgenmad","ota","weetabix","cheerios","rice krispies","guldkorn"]],
 ["Mejeri",["mælk","fløde","creme fraiche","crème fraîche","yoghurt","skyr","ymer","kærnemælk","smør","=æg","æg","kvark","margarine","piskefløde","madlavningsfløde","kefir"]],
 ["Frugt & grønt",["løg","porre","gulerod","gulerødder","kartoffel","kartofler","kål","broccoli","salat","agurk","tomat","peberfrugt","squash","courgette","aubergine","champignon","svampe","spinat","rucola","persille","koriander","basilikum","dild","purløg","mynte","ingefær","chili","citron","=lime","æble","pære","banan","appelsin","mandarin","klementin","druer","avocado","selleri","rødbede","pastinak","græskar","bær","frugt","grønt","krydderurter","majs","ærter","bønner","asparges","fennikel","radiser","kiwi","melon","ananas","mango"]],
 ["Brød & bager",["brød","pita","tortilla","wraps","boller","baguette","knækbrød","burgerboller","rundstykker","croissant","wienerbrød","kanelsnegl","flutes","flûtes","sandwich"]],
 ["Kød & fisk",["hakket","kød","kylling","flæsk","steg","kotelet","kalkun","bacon","pølse","pølser","medister","laks","torsk","fisk","rejer","frikadelle","mørbrad","nakke","filet","bryst","=lam","culotte","bøf","ribben","andebryst","andelår","=and","kyllingelår","rødspætte","sild","muslinger"]],
 ["Kolonial",["ris","pasta","spaghetti","penne","nudler","lasagneplader","couscous","bulgur","quinoa","olie","eddike","sennep","ketchup","mayonnaise","soja","honning","peanutbutter","syltetøj","marmelade","nødder","mandler","tahin","pesto","oliven","kapers","sirup","salt","peber","karry","spidskommen","paprika","kanel","laurbær","timian","oregano","rosmarin","krydderi","bagepulver","natron","gær","sukker","flormelis","hvedemel","rugmel","=mel","mel","vanilje","kakao","muskat","kardemomme","gurkemeje","rasp","rosiner","dressing","sauce","bouillon","fond","konserves","chokoladeknapper","marcipan","nutella"]],
 ["Snacks & slik",["chips","slik","chokolade","kiks","småkager","popcorn","lakrids","vingummi","peanuts","saltstænger","dip","nachos","snacks","bolsjer","pebernødder"]],
 ["Vin & øl",["=øl","=vin","rødvin","hvidvin","rosé","rosevin","champagne","cava","prosecco","snaps","spiritus","gin","whisky","vodka","=rom","cider","porter","pilsner","julebryg","hvidtøl","portvin"]],
 ["Drikkevarer",["iste","cola","juice","saft","sodavand","danskvand","kaffe","=te","mineralvand","=vand","kildevand","energidrik","smoothie","kakao drik","cacao"]]
];
function guessCat(name){
  const n=norm(name),words=n.split(" ");
  for(const [cat,keys] of CAT_RULES){for(const k0 of keys){
    if(k0[0]==="="){const k=k0.slice(1);if(words.includes(k)||(k.length>1&&words.some(w=>w.endsWith(k)&&w.length>k.length+2&&k!=="is"&&k!=="and"&&k!=="te"&&k!=="lys")))return cat;}
    else if(n.includes(norm(k0)))return cat;
  }}
  return "Andet";
}
const CAT_COL={"Frugt & grønt":"#5f9447","Brød & bager":"#b08030","Kød & fisk":"#c9483a","Pålæg":"#a46a48","Mejeri":"#4f7fc0","Ost":"#c99a22","Frost":"#5b6aa8","Kolonial":"#7a6a5e","Morgenmad":"#c7803a","Snacks & slik":"#d3a020","Drikkevarer":"#3f8f9a","Vin & øl":"#8a2030","Baby & børn":"#d0789a","Husholdning":"#5a9ea4","Personlig pleje":"#b04a64","Apotek":"#3a9a6a","Kæledyr":"#8a7a4a","Andet":"#8a6a8a"};
const STORE_COLS=["var(--saffron)","var(--teal)","var(--chili)","var(--aubergine)","var(--pistachio)","var(--indigo)","var(--paprika)","var(--rose)"];
function catColor(k){return CAT_COL[k]||STORE_COLS[Math.abs([...String(k)].reduce((a,c)=>a*31+c.charCodeAt(0)|0,7))%STORE_COLS.length];}
const catOf=it=>{let c=it.category;if(c==="Mejeri & æg"){const g=guessCat(it.name);return g==="Ost"?"Ost":"Mejeri";}c=CAT_OLD[c]||c;return CATS.includes(c)?c:guessCat(it.name);};
export { CATS, CAT_EMO, catColor, catOf };
