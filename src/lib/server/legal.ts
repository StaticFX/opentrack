import type { ImpressumConfig } from '$lib/server/config';

/**
 * Build a German GDPR privacy-policy template (Datenschutzerklärung) that
 * accurately describes what an OpenTrack instance actually processes:
 * server logs, strictly-necessary cookies, accounts, OAuth login, public
 * contributions, GitHub sync and (opt-in) web push.
 *
 * It is a starting point the operator MUST review — it is not legal advice.
 * When the stored privacy policy is blank, this template is rendered as-is on
 * `/datenschutz`; the admin editor also seeds its textarea from it.
 */
export function buildDatenschutzTemplate(
	imp: ImpressumConfig,
	opts: { origin: string; siteName: string }
): string {
	let host = opts.origin;
	try {
		host = new URL(opts.origin).host;
	} catch {
		/* keep raw origin */
	}

	const provider = imp.provider.trim() || '[Name des Betreibers — im Impressum eintragen]';
	const email = imp.email.trim() || '[Kontakt-E-Mail — im Impressum eintragen]';
	const addressLines = imp.address.trim()
		? imp.address
				.trim()
				.split('\n')
				.map((l) => l.trim())
				.filter(Boolean)
		: ['[Anschrift — im Impressum eintragen]'];

	const controllerBlock = [provider, ...addressLines, `E-Mail: ${email}`]
		.map((l) => l)
		.join('  \n');

	return `# Datenschutzerklärung

## 1. Verantwortlicher

Verantwortlich für die Datenverarbeitung auf dieser Website (${host}) im Sinne der
Datenschutz-Grundverordnung (DSGVO) ist:

${controllerBlock}

Weitere Angaben findest du im [Impressum](/impressum).

## 2. Allgemeines zur Datenverarbeitung

Wir verarbeiten personenbezogene Daten nur, soweit dies zur Bereitstellung einer
funktionsfähigen Website sowie unserer Inhalte und Leistungen erforderlich ist.
Rechtsgrundlagen sind insbesondere Art. 6 Abs. 1 lit. a (Einwilligung),
lit. b (Vertrag/Nutzungsverhältnis) und lit. f DSGVO (berechtigtes Interesse am
sicheren, funktionsfähigen Betrieb).

## 3. Hosting und Server-Logfiles

Beim Aufruf dieser Website werden durch den Browser automatisch Informationen an
den Server gesendet und vorübergehend in sogenannten Logfiles gespeichert:

- IP-Adresse des anfragenden Geräts,
- Datum und Uhrzeit des Zugriffs,
- aufgerufene Adresse (URL) und HTTP-Statuscode,
- übertragene Datenmenge, Referrer und verwendeter Browser (User-Agent).

Diese Daten dienen der Auslieferung der Seite, der Systemsicherheit und der
Stabilität. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Die Logfiles werden
gelöscht, sobald sie für den genannten Zweck nicht mehr erforderlich sind.

> Hinweis: Wird die Seite über einen vorgeschalteten Dienst (z. B. ein
> Content-Delivery-Network wie Cloudflare) ausgeliefert, ergänze hier den
> jeweiligen Auftragsverarbeiter und dessen Datenschutzhinweise.

## 4. Cookies

Diese Website verwendet ausschließlich **technisch notwendige Cookies**. Sie sind
für den Betrieb erforderlich, dienen nicht der Analyse oder Werbung und werden
nicht an Dritte zu Marketingzwecken weitergegeben. Rechtsgrundlage ist
§ 25 Abs. 2 TTDSG in Verbindung mit Art. 6 Abs. 1 lit. f DSGVO.

| Cookie | Zweck | Speicherdauer |
| --- | --- | --- |
| \`ot_session\` | Anmeldung / Sitzungsverwaltung eingeloggter Nutzer | Sitzung |
| \`ot_2fa_pending\` | Zwischenschritt der Zwei-Faktor-Anmeldung | wenige Minuten |
| \`ot_oauth_state\`, \`ot_oauth_redirect\`, \`ot_oauth_link\` | Absicherung des Logins über Drittanbieter (OAuth) | wenige Minuten |
| \`ot_anon\` | Missbrauchsschutz bei anonymen Abstimmungen (Zufalls-ID, mit der IP verkettet und als HMAC gespeichert — keine Klaridentität) | bis zu 12 Monate |

Ein Cookie-Hinweis informiert dich beim ersten Besuch. Da ausschließlich
notwendige Cookies gesetzt werden, ist keine Einwilligung erforderlich.

## 5. Nutzerkonto und Anmeldung

Legst du ein Konto an oder meldest dich an, verarbeiten wir die dabei angegebenen
Daten (Benutzername, Anzeigename, ggf. E-Mail-Adresse, ein sicher gehashtes
Passwort sowie optional eine Zwei-Faktor-Konfiguration). Zweck ist die
Bereitstellung des Kontos und der zugehörigen Funktionen. Rechtsgrundlage ist
Art. 6 Abs. 1 lit. b DSGVO. Die Daten werden gespeichert, bis du dein Konto
löschst oder die Löschung verlangst.

## 6. Anmeldung über Drittanbieter (OAuth)

Optional kannst du dich über externe Anbieter (z. B. GitHub, Discord, Modrinth
oder weitere vom Betreiber eingerichtete Dienste) anmelden. Dabei werden Daten
zwischen dir und dem jeweiligen Anbieter ausgetauscht; wir erhalten die zur
Anmeldung notwendigen Profilangaben (etwa Kennung, Anzeigename und ggf.
E-Mail-Adresse). Es gelten zusätzlich die Datenschutzhinweise des jeweiligen
Anbieters. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b bzw. lit. a DSGVO.

## 7. Öffentliche Beiträge (Kommentare, Vorschläge, Abstimmungen)

Beiträge wie Kommentare und Vorschläge sind öffentlich sichtbar und werden mit
deinem Anzeigenamen dargestellt. Abstimmungen sind angemeldet oder anonym
möglich; anonyme Stimmen werden ausschließlich zum Schutz vor Mehrfachabstimmung
über den unter Ziffer 4 beschriebenen, nicht personenbeziehbaren Schlüssel
verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO.

## 8. Synchronisation mit GitHub

Ist ein Projekt mit GitHub verbunden, werden Vorgänge (Tickets) und Kommentare
mit dem verknüpften GitHub-Repository synchronisiert und dorthin übertragen.
Anbieter ist die GitHub, Inc. Es gelten ergänzend deren Datenschutzhinweise.
Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.

## 9. Push-Benachrichtigungen

Nur wenn du dies ausdrücklich im Browser aktivierst, versenden wir
Push-Benachrichtigungen. Hierzu wird ein vom Browser bereitgestellter Endpunkt
gespeichert. Du kannst die Benachrichtigungen jederzeit im Browser oder in deinen
Kontoeinstellungen wieder deaktivieren. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a
DSGVO (Einwilligung).

## 10. Weitergabe von Daten

Eine Übermittlung deiner Daten an Dritte findet nur statt, soweit dies für den
Betrieb erforderlich ist (z. B. an den Hosting-Dienstleister als
Auftragsverarbeiter), du eingewilligt hast (z. B. OAuth, GitHub-Sync) oder wir
gesetzlich dazu verpflichtet sind.

## 11. Übermittlung in Drittländer

Soweit du dich über einen Anbieter mit Sitz außerhalb der EU/des EWR anmeldest
(z. B. GitHub oder Discord in den USA) oder ein Projekt mit GitHub verbunden ist,
können personenbezogene Daten in ein Drittland — insbesondere die USA —
übermittelt werden. Eine solche Übermittlung erfolgt nur auf Grundlage eines
Angemessenheitsbeschlusses der EU-Kommission (z. B. EU-US Data Privacy Framework,
sofern der Empfänger zertifiziert ist) oder geeigneter Garantien im Sinne des
Art. 46 DSGVO (insbesondere Standardvertragsklauseln). Eine Kopie der Garantien
kann beim Verantwortlichen angefordert werden.

> Hinweis: Ergänze hier, auf welcher Grundlage (Data-Privacy-Framework-Zertifizierung
> des jeweiligen Anbieters oder Standardvertragsklauseln) die Übermittlung im
> konkreten Fall erfolgt.

## 12. Speicherdauer

Wir verarbeiten personenbezogene Daten nur so lange, wie es für die jeweiligen
Zwecke erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.
Anschließend werden die Daten gelöscht.

## 13. Deine Rechte

Dir stehen gegenüber dem Verantwortlichen folgende Rechte hinsichtlich deiner
personenbezogenen Daten zu:

- Auskunft (Art. 15 DSGVO),
- Berichtigung (Art. 16 DSGVO),
- Löschung (Art. 17 DSGVO),
- Einschränkung der Verarbeitung (Art. 18 DSGVO),
- Datenübertragbarkeit (Art. 20 DSGVO),
- Widerspruch gegen die Verarbeitung (Art. 21 DSGVO) sowie
- Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).

Zur Ausübung genügt eine formlose Nachricht an ${email}.

## 14. Beschwerderecht bei einer Aufsichtsbehörde

Unbeschadet anderweitiger Rechtsbehelfe steht dir ein Beschwerderecht bei einer
Datenschutz-Aufsichtsbehörde zu, insbesondere in dem Mitgliedstaat deines
Aufenthalts, deines Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes.

## 15. Kontakt

Bei Fragen zum Datenschutz erreichst du uns unter ${email}.

_Diese Datenschutzerklärung ist eine Vorlage und vom Betreiber vor
Veröffentlichung zu prüfen und anzupassen. Sie stellt keine Rechtsberatung dar._
`;
}
