# SMHI

Die offiziellen Wettervorhersagen des **Schwedischen Meteorologischen und
Hydrologischen Instituts (SMHI)** in Gladys: aktuelle Werte, Vorhersagen
Stunde für Stunde und Tag für Tag sowie die Wetterwarnungen des SMHI für
Schweden. Öffentliche Daten, kein Konto, kein API-Schlüssel.

> Nicht mit SMHI verbunden. Ohne Live-Test gegen SMHI entwickelt: Rückmeldungen
> im Gladys-Forum sind willkommen.

## Was die Integration macht

- **Ein Gerät pro Ort**: jedes Haus mit Standort in Gladys und optional ein
  Ort, den du über seine Koordinaten angibst (Ferienhaus, Bootshafen…).
- **Das aktuelle Wetter** des Orts, alle 30 Minuten aktualisiert: Temperatur,
  gefühlte Temperatur, Luftfeuchtigkeit, Luftdruck, Wind (Mittel, Böen,
  Richtung), Bewölkung, Niederschlag (Intensität und Art), Sichtweite,
  Gewitterwahrscheinlichkeit und das Wetter in Worten.
- **Die Wetterwarnungen des SMHI** (gelb, orange, rot), deren Gebiet den Ort
  abdeckt: als Stufe, die Gladys-Szenen vergleichen können, als Text und als
  Szenenauslöser.
- Ein **Dashboard-Widget** mit den nächsten 24 Stunden und den kommenden
  Tagen.
- Eine **Szenenaktion**, die einen Tag der Vorhersage liest (heute, morgen,
  übermorgen) für eine Morgennachricht oder einen Frostalarm.

Die Vorhersage deckt das Gebiet des SMHI-Modells ab: die nordischen Länder und
den Ostseeraum (Schweden, Norwegen, Finnland, Dänemark, die baltischen Staaten
und die Meere dazwischen). Warnungen gibt es nur für Schweden und seine
Gewässer.

## Voraussetzungen

- Gladys Assistant 5.1.0 oder neuer.
- Gladys muss `opendata-download-metfcst.smhi.se` und
  `opendata-download-warnings.smhi.se` über HTTPS erreichen.
- Für die Häuser: ein Standort unter **Einstellungen → Häuser** in Gladys.

## Installation

1. Öffne in Gladys **Integrationen → Von GitHub installieren** und gib
   `https://github.com/guim31/gladys-smhi` ein, oder installiere **SMHI** aus
   dem Store.
2. Erlaube den Zugriff auf den Standort der Häuser: Er dient nur dazu, SMHI
   nach der Vorhersage jedes Hauses zu fragen.
3. Öffne den Reiter **Erkennung** der Integration und füge die Geräte der
   gewünschten Orte hinzu.

## Konfiguration

| Feld                                | Standard    | Zweck                                                                   |
| ----------------------------------- | ----------- | ----------------------------------------------------------------------- |
| Vorhersage für die Häuser in Gladys | an          | Ein Gerät pro Haus mit Standort in Gladys.                              |
| Anderer Ort: Breitengrad            | leer        | Dezimalgrad (`59.3293`, ein Komma geht auch). Leer: nur die Häuser.     |
| Anderer Ort: Längengrad             | leer        | Dezimalgrad, nach Osten positiv (`18.0686`).                            |
| Anderer Ort: Name                   | SMHI        | Name des Geräts dieses Orts.                                            |
| Provinz für die Warnungen           | Automatisch | Automatisch: die Warnungen, deren gezeichnetes Gebiet den Ort enthält.  |
| Aktualisierungsintervall            | 30 min      | 15 min, 30 min oder 1 Stunde. SMHI aktualisiert etwa einmal pro Stunde. |
| Sprache                             | Französisch | Funktionsnamen neuer Geräte, Wetter- und Warntexte, Zusammenfassungen.  |

Wählst du eine **Provinz** (län), bleiben auch alle Warnungen, die die Provinz
berühren, selbst wenn ihr gezeichnetes Gebiet den Ort nicht enthält: nützlich
am Rand eines Gebiets, dafür kommen Warnungen für das andere Ende der Provinz
hinzu.

Die Funktionsnamen werden beim Hinzufügen des Geräts festgelegt: Ändere zuerst
die Sprache und füge dann die Geräte hinzu.

## Das Gerät eines Orts

| Funktion                   | Einheit | Hinweise                                                                |
| -------------------------- | ------- | ----------------------------------------------------------------------- |
| Temperatur                 | °C      | Lufttemperatur in 2 m Höhe.                                             |
| Gefühlte Temperatur        | °C      | Berechnet (Steadman-Formel: Temperatur, Luftfeuchtigkeit, Wind).        |
| Luftfeuchtigkeit           | %       | Relative Luftfeuchtigkeit.                                              |
| Luftdruck                  | hPa     | Auf Meereshöhe.                                                         |
| Windgeschwindigkeit        | m/s     | Mittlerer Wind in 10 m Höhe.                                            |
| Windböen                   | m/s     |                                                                         |
| Windrichtung               | °       | Woher der Wind kommt (0 Nord, 90 Ost).                                  |
| Bewölkung                  | %       | Bedeckter Anteil des Himmels.                                           |
| Niederschlag               | mm/h    | Mittlere Intensität der Stunde.                                         |
| Niederschlagsart           | Text    | Regen, Schnee, Schneeregen, Nieselregen… sonst „Kein Niederschlag“.     |
| Sichtweite                 | km      |                                                                         |
| Gewitterwahrscheinlichkeit | %       |                                                                         |
| Wetter                     | Text    | Das Wettersymbol des SMHI in Worten (Bedeckt, Leichter Regen…).         |
| Warnstufe                  | 0 bis 3 | 0 keine, 1 gelb, 2 orange, 3 rot: die höchste Warnung des Orts.         |
| Warnungen                  | Text    | Die laufenden Warnungen, die schwerste zuerst, mit dem Ende der ersten. |

Alle Funktionen sind schreibgeschützt. Die Werte sind die der Vorhersage für
die laufende Stunde: SMHI veröffentlicht eine Modellvorhersage, keine
Messwerte einer Wetterstation. Gladys rechnet Temperatur, Geschwindigkeit und
Entfernung in die Einheiten jedes Benutzers um.

## Dashboard-Widget

Füge das Widget **SMHI-Vorhersage** zu einem Dashboard hinzu und wähle den
Ort (ohne Auswahl den ersten). Es zeigt das Wetter in Worten und die Zeit der
letzten Abfrage, die Temperatur, die gefühlte Temperatur und den Wind, eine
Kurve der nächsten 24 Stunden, die laufenden Warnungen und sechs Tage (Wetter,
Tiefst- und Höchsttemperatur, Niederschlag). Es folgt der Sprache und den
Einheiten des Benutzers.

## Szenenauslöser: neue SMHI-Wetterwarnung

Löst aus, wenn SMHI eine Warnung ausgibt, deren Gebiet einen Ort abdeckt, oder
die Stufe einer laufenden Warnung erhöht (gelb auf orange…). Filter: der Ort,
die Stufen. Variablen für die folgenden Aktionen: die Stufe (`yellow`,
`orange`, `red`), das Ereignis, das Gebiet, die Beschreibung, Beginn und Ende.
SMHI schreibt Ereignisse und Beschreibungen auf Schwedisch und Englisch: Die
Integration gibt die englischen weiter.

Eine Warnung wird einmal gemeldet: Weder eine neue Abfrage noch ein Neustart
der Integration lösen den Auslöser für dieselbe Warnung auf derselben Stufe
erneut aus.

## Szenenaktion: SMHI-Vorhersage lesen

Wähle den Ort und den Tag (heute, morgen, übermorgen). Die Aktion liefert für
die folgenden Aktionen der Szene: Tiefst- und Höchsttemperatur (°C),
Niederschlag (mm), die stärkste Böe (m/s), die höchste
Gewitterwahrscheinlichkeit (%), das Wetter in Worten und einen
zusammenfassenden Satz in der Sprache der Konfiguration.

## Konfigurationsaktion: Vorhersage prüfen

Die Schaltfläche **Vorhersage prüfen** fragt SMHI sofort für jeden Ort ab,
hinzugefügt oder nicht, und zeigt die Antwort: Temperatur, Wetter und
Warnstufe, oder den Grund eines Fehlers (Ort außerhalb des
Vorhersagegebiets, SMHI antwortet nicht).

## Szenenbeispiele

- **Morgennachricht**: um 7:00 _SMHI-Vorhersage lesen_ (heute), dann die
  Ausgabe _Zusammenfassung_ per Nachricht an die Familie senden.
- **Frostalarm**: um 18:00 _SMHI-Vorhersage lesen_ (morgen); liegt die
  _Tiefsttemperatur_ unter 0, „Deck heute Abend die Pflanzen ab“ senden.
- **Sturm**: Auslöser _Neue SMHI-Wetterwarnung_ mit den Stufen orange und rot,
  dann Ereignis und Beschreibung senden und die Markise einfahren.
- **Gewitter**: wenn die _Gewitterwahrscheinlichkeit_ über 50 % steigt,
  empfindliche Geräte ausschalten.

## Aktualisierung und Kontingente

Die Integration aktualisiert sich selbst im gewählten Intervall (standardmäßig
30 Minuten), auch wenn Gladys das Gerät nicht abfragt. Jede Aktualisierung
stellt eine Anfrage pro hinzugefügtem Ort und eine für die Warnungen (ganz
Schweden auf einmal). Orte, deren Gerät nicht hinzugefügt wurde, werden nie
gelesen, außer über die Schaltfläche _Vorhersage prüfen_. SMHI veröffentlicht
kein Kontingent für seine offenen Daten und aktualisiert sein Modell etwa
einmal pro Stunde: Ein kürzeres Intervall bringt nichts. Die Daten werden von
SMHI unter der Lizenz Creative Commons Namensnennung 4.0 veröffentlicht.

## Fehlerbehebung

- **„Kein Ort“**: Kein Haus in Gladys hat einen Standort und keine Koordinaten
  sind eingetragen. Gib einem Haus einen Standort (Einstellungen → Häuser) oder
  trag Breiten- und Längengrad ein.
- **„Koordinaten nicht lesbar“**: Trag Dezimalgrad ein, etwa `59.3293` und
  `18.0686`, keine Grad und Minuten.
- **„Außerhalb des SMHI-Vorhersagegebiets“**: Der Ort liegt außerhalb des
  Gebiets des SMHI-Modells (nordische und baltische Länder). Dort brauchst du
  eine andere Integration.
- **„SMHI antwortet nicht“**: Gladys erreicht SMHI nicht (Netzwerk, DNS,
  Ausfall bei SMHI). Die letzte Vorhersage bleibt, solange sie die Gegenwart
  abdeckt, und bei der nächsten Aktualisierung folgt ein neuer Versuch.
- **Keine Warnung, obwohl SMHI eine zeigt**: Das gezeichnete Gebiet der
  Warnung enthält vielleicht nicht den genauen Punkt des Orts. Wähle deine
  Provinz unter _Provinz für die Warnungen_.
- **Mehr Details**: Setz `LOG_LEVEL=debug` für die Integration, um jede
  Abfrage in ihren Protokollen zu sehen.

## Einschränkungen

- Eine Vorhersage, keine Messung: Die Werte stammen aus dem SMHI-Modell für
  den nächsten Punkt seines Gitters (etwa 2,5 km).
- Die Warnungen gelten nur für Schweden; ihre Texte sind auf Englisch.
- Funktions- und Gerätenamen werden beim Hinzufügen des Geräts festgelegt.
- Kein UV-Index, keine Pollen, keine Waldbrandgefahr: SMHI veröffentlicht sie
  anderswo.
- Änderst du die Koordinaten des _anderen Orts_, entsteht ein neues Gerät (ein
  neuer Ort hat seinen eigenen Verlauf).

## Danksagung und Lizenz

Daten: © SMHI, Creative Commons Namensnennung 4.0. Das Lesen der API folgt der
Home-Assistant-Integration `smhi` und der Bibliothek `pysmhi` von G Johansson
(MIT). Integration unter der Lizenz Apache 2.0. Nicht mit SMHI verbunden.
