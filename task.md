Das Ziel ist, für Forschungszwecke eine mini Instagram Feed Applikation nachzubauen. Wir wollen in unserer Forschung mittels einer simulierten Instagram Feed umgebung Posts
anzeigen, welche Religiöse oder nicht eindeutig religiöse oder garnicht religiöse Inhalte aufzeigen. Die Probanden sollen auf unserere Mock-Insta Applikation durch den Feed
scrollen und dann verschiedene Aktionen pro Post tätigen können. Die Aktionen sind im Folgenden gelistet:

- Post liken
- Follow Button
- Religion erkannt Button

Die Profile sollen Random heissen. Es sind total 50 Posts die jeder Proband bekommen wird, dh. wir machen 50 Profilnamen die als Array gespeichert werden können. Die directory postImages
beinhaltet dann alle Posts die man anzeigt. Aktuell ist da ein Bild drin und du kannst es für jeden post verwenden. Das wird später angepasst.

Das frontend soll Angular sein, darkmode, modernes Angular und natürlich exakt so aussehen wie Instagram. Bloss eben mit den reduzierten funktionen. Kannst aber die Restlichen insta
Buttons mocken, die sind dann halt funktionslos. Das Backend ist ein python backend. Das Backend soll die Daten dann in ein csv rein schreiben. Ein Post hat eine ID. Zudem sammeln
wir beim ersten click auf die Applikationsurl erst demografische daten. Erst wenn der user diese eingegeben hat, kommt man in den Feed. Es gibt keine Authentication. Die 
Demorgrafischen Daten sind die folgenden:

- alter
- religionsangehörigkeit (dropdown)
- höchster Bildungsabschluss (schweizer system dropdown)
- Herkunft
- politische Einstellung (skala 1:ganz links bis 10:ganz rechts)
- user email hash -> im frontend wird die email verhasht mit sha256 und im backend dann als userEmailHash gespeichert. (damit man einen user identifizieren kann ohne seine email zu haben)

pro post feedback wird eine zeile ins csv geschrieben mit all den columns die oben gelistet sind + der userEmailHash

Aktuell soll das ganze mal localhost server werden aber bereits mit 0.0.0.0 vorbereitet für später. Das csv. ist immer Append, dh nie überschreiben. Wenns aber noch nicht existiert
wirds beim applikationsstart generiert. 

Die Applikation ist mobile first entwickelt und wird auf dem desktop wie instagram leicht verbreitert und zentriert. 

Die PostID ist der filename ohne das .jpg oder .png oder was auch immer für eine Endung es hat. 

Arbeite auch mit icons. Am liebsten mit solchen, die Instagram auch sonst braucht. Mach gerne eine websearch um instagram anzuschauen wie es aktuell aussieht um das design genau so hinzukriegen.

In /Users/severingoddon/Desktop/docs/Coding/PycharmProjects/PlatformSimulator/instaExample.html ist ein ausschnitt vom instagram DOM als orientierungshilfe falls das hilft.