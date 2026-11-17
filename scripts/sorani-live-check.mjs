import { translatedText, translationUrl, assertSoraniScript, soraniRtl } from '../src/translate.js';
const examples = {
 en: 'Hello my friend. We must find our way home before the sun goes down. Please do not forget the message.',
 ar: 'مرحباً يا صديقي، يجب علينا العودة إلى المنزل قبل غروب الشمس. أرجوك لا تنس الرسالة المهمة.',
 zh: '你好，我的朋友。我们必须在太阳落山之前找到回家的路。请不要忘记这个重要的信息。',
 tr: 'Merhaba arkadaşım. Güneş batmadan önce eve dönüş yolunu bulmalıyız. Lütfen önemli mesajı unutma.',
};
for (const [lang, text] of Object.entries(examples)) {
 const url = translationUrl(text, 'ckb');
 const response = await fetch(url, {headers: {'User-Agent':'node'}, signal: AbortSignal.timeout(30000)});
 if (!response.ok) throw Error(`${lang} HTTP ${response.status}`);
 const translated = translatedText(await response.json());
 assertSoraniScript([{text: translated}]);
 if (!soraniRtl([{text:translated}])[0].text.startsWith('\u200f')) throw Error('RTL missing');
 console.log(`::notice title=Sorani translation::${lang} auto-detected to Arabic-script Sorani: ${translated.replace(/%/g,'%25').slice(0,200)}`);
}
