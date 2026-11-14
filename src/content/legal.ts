/**
 * Farm For You's legal pages (docs/platform-plan.md §3.8), in Tamil and English: terms, privacy, refunds, the farm
 * seller agreement and the prohibited items policy. Shown at /legal/<doc> on every address.
 *
 * DRAFT: written in plain words for farms and customers, NOT yet checked by a lawyer. Until it is, REVIEWED stays
 * false and each page says it is being checked. When a lawyer changes the seller agreement or the prohibited items
 * policy, bump AGREEMENT_VERSION in src/domain/applications.ts so new farms accept the new one.
 */

export const LEGAL_REVIEWED = false
export const LEGAL_UPDATED = "2026-11-14"

type T = { ta: string; en: string }
export interface LegalDoc {
  title: T
  intro: T
  sections: { heading: T; points: T[] }[]
}

export const LEGAL_DOCS = ["terms", "privacy", "refunds", "seller-agreement", "prohibited-items"] as const
export type LegalKey = (typeof LEGAL_DOCS)[number]
export const isLegalKey = (k: string): k is LegalKey => (LEGAL_DOCS as readonly string[]).includes(k)

export const LEGAL: Record<LegalKey, LegalDoc> = {
  terms: {
    title: { ta: "பயன்பாட்டு விதிமுறைகள்", en: "Terms of use" },
    intro: {
      ta: "Farm For You என்பது பண்ணைகள் தங்கள் வேலையை நடத்தவும், வாடிக்கையாளர்களுக்கு நேரடியாக விற்கவும் உதவும் இணையதளம் மற்றும் செயலி. இதைப் பயன்படுத்தும்போது இந்த விதிமுறைகளை ஏற்கிறீர்கள்.",
      en: "Farm For You is a website and app that helps farms run their work and sell straight to customers. By using it, you accept these terms.",
    },
    sections: [
      {
        heading: { ta: "யார் விற்கிறார்கள்", en: "Who sells to you" },
        points: [
          { ta: "ஒவ்வொரு கடையும் அந்தப் பண்ணையுடையது. பொருள், விலை, தரம், டெலிவரி அனைத்துக்கும் அந்தப் பண்ணையே பொறுப்பு.", en: "Each shop belongs to its farm. The farm is responsible for its products, prices, quality and delivery." },
          { ta: "Farm For You பண்ணைக்கும் வாடிக்கையாளருக்கும் இடையே உள்ள தளம் மட்டுமே; நாங்கள் பொருட்களை வாங்கியோ விற்றோ இல்லை.", en: "Farm For You is the platform between farm and customer; we don't buy or sell the products ourselves." },
        ],
      },
      {
        heading: { ta: "உங்கள் கணக்கு", en: "Your account" },
        points: [
          { ta: "உண்மையான பெயர், கைபேசி எண், முகவரி தாருங்கள். உங்கள் கடவுச்சொல்லை யாரிடமும் பகிராதீர்கள்.", en: "Give your real name, mobile number and address. Don't share your password with anyone." },
          { ta: "தவறான பயன்பாடு, மோசடி அல்லது சட்டத்துக்கு எதிரான செயல் இருந்தால் கணக்கை நிறுத்தலாம்.", en: "We may stop an account that is misused, used for fraud or for anything against the law." },
        ],
      },
      {
        heading: { ta: "ஆர்டர்களும் பணமும்", en: "Orders and payment" },
        points: [
          { ta: "ஆர்டர் செய்த பிறகு பண்ணை அழைத்து உறுதி செய்யலாம். பணம் பண்ணைக்கு நேரடியாகச் செல்கிறது (UPI, ரொக்கம்).", en: "After you order, the farm may call to confirm. Payment goes straight to the farm (UPI or cash)." },
          { ta: "திருப்பித் தருதல், பணம் திரும்பப் பெறுதல் பற்றி எங்கள் பணம் திரும்பப் பெறும் கொள்கையைப் பாருங்கள்.", en: "For returns and refunds, see our refund policy." },
        ],
      },
      {
        heading: { ta: "பொறுப்பு", en: "Liability" },
        points: [
          { ta: "சேவையை நன்றாக நடத்த முயல்கிறோம், ஆனால் எப்போதும் இடையூறு இல்லாமல் இயங்கும் என உறுதி தர முடியாது.", en: "We work to keep the service running well, but can't promise it will never be interrupted." },
          { ta: "இந்த விதிமுறைகள் இந்தியச் சட்டத்தின்படி; வழக்குகள் தமிழ்நாட்டு நீதிமன்றங்களில்.", en: "These terms follow Indian law; disputes go to the courts of Tamil Nadu." },
        ],
      },
    ],
  },

  privacy: {
    title: { ta: "தனியுரிமைக் கொள்கை", en: "Privacy policy" },
    intro: {
      ta: "உங்கள் தகவல் உங்களுடையது. இந்தியாவின் டிஜிட்டல் தனிநபர் தரவுப் பாதுகாப்புச் சட்டம், 2023 (DPDP) படி நாங்கள் எதைச் சேகரிக்கிறோம், ஏன், எப்படிக் காக்கிறோம் என்பது இங்கே.",
      en: "Your information is yours. Here is what we collect, why, and how we protect it, under India's Digital Personal Data Protection Act, 2023 (DPDP).",
    },
    sections: [
      {
        heading: { ta: "எதைச் சேகரிக்கிறோம்", en: "What we collect" },
        points: [
          { ta: "பெயர், கைபேசி எண், மின்னஞ்சல், டெலிவரி முகவரி, இருப்பிடம் (நீங்கள் தந்தால்), ஆர்டர்கள்.", en: "Name, mobile number, email, delivery address, location (if you give it), and your orders." },
          { ta: "பண்ணைகளிடமிருந்து: வணிக விவரங்கள் (FSSAI, GSTIN, PAN) மற்றும் பண்ணையின் பதிவுகள்.", en: "From farms: business details (FSSAI, GSTIN, PAN) and the farm's own records." },
          { ta: "ஆதார் எண்ணை நாங்கள் கேட்பதோ சேமிப்பதோ இல்லை.", en: "We don't ask for or store Aadhaar numbers." },
        ],
      },
      {
        heading: { ta: "ஏன் பயன்படுத்துகிறோம்", en: "Why we use it" },
        points: [
          { ta: "ஆர்டர்களை வழங்க, பில் தர, உங்களை அழைக்க அல்லது WhatsApp செய்திகள் அனுப்ப (நீங்கள் ஒப்புக்கொண்டால்).", en: "To deliver orders, make bills, and call you or send WhatsApp messages (when you agree)." },
          { ta: "உங்கள் தகவலை விற்பதில்லை. ஒரு பண்ணையின் வாடிக்கையாளர்களை மற்றொரு பண்ணை பார்க்க முடியாது.", en: "We never sell your information. One farm can't see another farm's customers." },
        ],
      },
      {
        heading: { ta: "எங்கே, எவ்வளவு காலம்", en: "Where and for how long" },
        points: [
          { ta: "தகவல் இந்தியாவில் (மும்பை) பாதுகாப்பான சர்வர்களில் சேமிக்கப்படுகிறது.", en: "Information is stored on secure servers in India (Mumbai)." },
          { ta: "தேவையான காலம் வரை மட்டும்; பில்கள் வரிச் சட்டம் கேட்கும் காலம் வரை. நிராகரிக்கப்பட்ட பண்ணை விண்ணப்பங்களின் ஆவணங்கள் நீக்கப்படும்.", en: "Only as long as needed; bills as long as tax law asks. Documents from turned-down farm applications are deleted." },
        ],
      },
      {
        heading: { ta: "உங்கள் உரிமைகள்", en: "Your rights" },
        points: [
          { ta: "உங்கள் தகவலைப் பார்க்க, திருத்த, நீக்கச் சொல்ல, ஒப்புதலைத் திரும்பப் பெற உரிமை உண்டு.", en: "You can ask to see, correct or delete your information, and withdraw your consent." },
          { ta: "புகார்களுக்கு கீழே உள்ள எண் அல்லது மின்னஞ்சலில் எங்களைத் தொடர்புகொள்ளுங்கள்; 30 நாட்களுக்குள் பதில் தருவோம்.", en: "For complaints, contact us at the number or email below; we reply within 30 days." },
        ],
      },
    ],
  },

  refunds: {
    title: { ta: "பணம் திரும்பப் பெறும் கொள்கை", en: "Refund policy" },
    intro: {
      ta: "பண்ணைப் பொருட்கள் புதியவை, விரைவில் கெடக்கூடியவை. சிக்கல் இருந்தால் அதே நாளில் பண்ணையைத் தொடர்புகொள்ளுங்கள்.",
      en: "Farm products are fresh and spoil quickly. If something is wrong, tell the farm the same day.",
    },
    sections: [
      {
        heading: { ta: "வாடிக்கையாளர்களுக்கு", en: "For customers" },
        points: [
          { ta: "உடைந்த, கெட்ட, குறைவான அல்லது தவறான பொருள்: டெலிவரி நாளிலேயே படத்துடன் பண்ணையிடம் சொல்லுங்கள்.", en: "Broken, spoiled, short or wrong items: tell the farm on the day of delivery, with a photo." },
          { ta: "பண்ணை மாற்றுப் பொருள், அடுத்த ஆர்டரில் கழிவு அல்லது பணம் திரும்பத் தரும் (UPI-யில் 7 நாட்களுக்குள்).", en: "The farm gives a replacement, credit on your next order, or your money back (by UPI within 7 days)." },
          { ta: "டெலிவரிக்கு முன் ஆர்டரை ரத்து செய்யலாம்; முன்பணம் கொடுத்திருந்தால் முழுமையாகத் திரும்பும்.", en: "You can cancel before delivery; anything paid in advance is returned in full." },
        ],
      },
      {
        heading: { ta: "பண்ணைகளுக்கு (Farm For You சந்தா)", en: "For farms (Farm For You subscription)" },
        points: [
          { ta: "சோதனைக் காலம் இலவசம். செலுத்திய மாதத்தின் பணம் திரும்பாது; அடுத்த மாதத்திலிருந்து எப்போது வேண்டுமானாலும் நிறுத்தலாம்.", en: "The trial is free. A month already paid isn't refunded; you can stop from the next month at any time." },
          { ta: "எங்கள் தவறால் சேவை கிடைக்கவில்லை என்றால், அந்த நாட்களுக்கான கழிவு தருவோம்.", en: "If the service was unavailable through our fault, we credit those days." },
        ],
      },
    ],
  },

  "seller-agreement": {
    title: { ta: "பண்ணை விற்பனையாளர் ஒப்பந்தம்", en: "Farm seller agreement" },
    intro: {
      ta: "Farm For You-இல் சேரும் ஒவ்வொரு பண்ணையும் இதை ஏற்கிறது. வாடிக்கையாளர்கள் நம்பிக்கையுடன் வாங்க இது உதவுகிறது.",
      en: "Every farm that joins Farm For You accepts this. It helps customers buy with confidence.",
    },
    sections: [
      {
        heading: { ta: "உண்மையான பண்ணை, உண்மையான விவரங்கள்", en: "A real farm, real details" },
        points: [
          { ta: "பண்ணை, உரிமையாளர், இருப்பிடம், ஆவணங்கள் பற்றிய விவரங்கள் உண்மையானவை. மாறினால் உடனே புதுப்பிப்பீர்கள்.", en: "The details of the farm, owner, location and documents are true, and you'll update them when they change." },
          { ta: "Farm For You குழு அழைத்தோ, வீடியோ அழைப்பிலோ, நேரில் வந்தோ சரிபார்க்கலாம்.", en: "The Farm For You team may check by a call, a video call or a visit." },
        ],
      },
      {
        heading: { ta: "பொருட்களும் சட்டமும்", en: "Products and the law" },
        points: [
          { ta: "சட்டப்படி விற்கக்கூடிய பொருட்களை மட்டும் விற்பீர்கள். தடைசெய்யப்பட்ட பொருட்கள் கொள்கையைப் பின்பற்றுவீர்கள்.", en: "You sell only what the law allows, and follow the prohibited items policy." },
          { ta: "உணவுப் பொருட்களுக்குத் தேவையான FSSAI பதிவு அல்லது உரிமம் உங்களிடம் இருக்கும்; GST பொருந்தினால் அதையும் நீங்களே செலுத்துவீர்கள்.", en: "You hold the FSSAI registration or licence your food items need, and handle GST yourself where it applies." },
          { ta: "பொருளின் படம், எடை, விலை உண்மையாக இருக்கும்.", en: "Product photos, weights and prices are honest." },
        ],
      },
      {
        heading: { ta: "வாடிக்கையாளர்கள்", en: "Customers" },
        points: [
          { ta: "வாடிக்கையாளர்களின் தகவலை ஆர்டர்களுக்கு மட்டும் பயன்படுத்துவீர்கள்; விற்கவோ பகிரவோ மாட்டீர்கள்.", en: "You use customers' information only for their orders, and never sell or share it." },
          { ta: "புகார்களுக்கு நியாயமாகப் பதில் தந்து, பணம் திரும்பப் பெறும் கொள்கையைப் பின்பற்றுவீர்கள்.", en: "You answer complaints fairly and follow the refund policy." },
        ],
      },
      {
        heading: { ta: "சந்தாவும் நிறுத்தமும்", en: "Subscription and stopping" },
        points: [
          { ta: "தேர்ந்தெடுத்த திட்டத்தின் கட்டணத்தை பில்லில் உள்ள கடைசி நாளுக்குள் செலுத்துவீர்கள்.", en: "You pay your plan's fee by the date on the bill." },
          { ta: "இந்த ஒப்பந்தத்தை மீறினால், பொருட்களை மறைக்கவோ கணக்கை நிறுத்தவோ Farm For You-க்கு உரிமை உண்டு. உங்கள் தகவலை ஏற்றுமதி செய்துகொள்ளலாம்.", en: "If this agreement is broken, Farm For You may hide products or stop the account. You can always export your data." },
        ],
      },
    ],
  },

  "prohibited-items": {
    title: { ta: "தடைசெய்யப்பட்ட பொருட்கள் கொள்கை", en: "Prohibited items policy" },
    intro: {
      ta: "சட்டத்துக்கு எதிரான பொருட்களை Farm For You-இல் விற்க முடியாது. சந்தேகமான பொருட்கள் Farm For You குழு பார்க்கும் வரை மறைக்கப்படும்.",
      en: "Nothing against the law can be sold on Farm For You. Anything doubtful stays hidden until the Farm For You team looks at it.",
    },
    sections: [
      {
        heading: { ta: "விற்கக் கூடாதவை", en: "Never allowed" },
        points: [
          { ta: "காட்டு விலங்குகள், பறவைகள், அவற்றின் இறைச்சி, முட்டை, உறுப்புகள் (வனவிலங்குப் பாதுகாப்புச் சட்டம்): மயில், ஆமை, காட்டுப்பன்றி, கிளி, முனியா போன்றவை.", en: "Wild animals and birds, and their meat, eggs or parts (Wildlife Protection Act): such as peafowl, turtles, wild boar, parakeets and munias." },
          { ta: "தடைசெய்யப்பட்ட மீன் வகைகள் (எ.கா. ஆப்பிரிக்க கெளுத்தி / தாய் மாகூர்).", en: "Banned fish species (e.g. African catfish / Thai magur)." },
          { ta: "தடைசெய்யப்பட்ட பூச்சிக்கொல்லிகள், அனுமதியில்லாத கால்நடை மருந்துகள்.", en: "Banned pesticides and unapproved animal medicines." },
          { ta: "கள், சாராயம் உள்ளிட்ட மதுபானங்கள்; போதைச் செடிகள்.", en: "Alcohol, including toddy and arrack; narcotic plants." },
        ],
      },
      {
        heading: { ta: "அனுமதியுடன் மட்டும்", en: "Only with a licence" },
        points: [
          { ta: "பொதி செய்த அல்லது பதப்படுத்திய உணவு: FSSAI உரிமம் பதிவேற்றிய பிறகு.", en: "Packed or processed food: once the farm's FSSAI licence is on file." },
          { ta: "தமிழ்நாட்டு விலங்குச் சட்டங்களின் கீழ் கட்டுப்பாடுள்ள கால்நடைப் பொருட்கள்: Farm For You குழு பார்த்த பிறகு.", en: "Livestock items restricted under Tamil Nadu's animal laws: after the Farm For You team checks." },
        ],
      },
      {
        heading: { ta: "மீறினால்", en: "If it happens" },
        points: [
          { ta: "பொருள் உடனே மறைக்கப்படும், பண்ணைக்குக் காரணம் சொல்லப்படும். மீண்டும் மீண்டும் நடந்தால் கணக்கு நிறுத்தப்படலாம்.", en: "The item is hidden at once and the farm is told why. Repeated cases may stop the account." },
        ],
      },
    ],
  },
}
