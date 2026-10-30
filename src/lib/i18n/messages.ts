import type { Locale } from "@/lib/i18n/locale";

export type Messages = {
  nav: {
    groups: {
      platform: string;
      admin: string;
      work: string;
      people: string;
      reputation: string;
      places: string;
      insight: string;
      learn: string;
      later: string;
      workspace: string;
    };
    items: Record<string, { label: string; description: string }>;
    logout: string;
    activeTenant: string;
    live: string;
    groupBadge: string;
    brandBadge: string;
  };
  shell: {
    searchPlaceholder: string;
    demoUi: string;
  };
  login: {
    eyebrow: string;
    signInTitle: string;
    signInHint: string;
    email: string;
    password: string;
    continue: string;
    signingIn: string;
    demoCredentials: string;
    loginFailed: string;
    networkError: string;
    pendingActivation: string;
    accountDisabled: string;
    phaseNote: string;
    phaseTip: string;
    noAccount: string;
    signUp: string;
    signUpTip: string;
    or: string;
    continueGoogle: string;
    continueFacebook: string;
    socialTip: string;
    socialTermsBefore: string;
    socialTermsLink: string;
    socialTermsAnd: string;
    socialPrivacyLink: string;
    socialTermsAfter: string;
    cardFooter: string;
  };
  signup: {
    eyebrow: string;
    title: string;
    hint: string;
    nameBrand: string;
    wantsGroup: string;
    wantsGroupHint: string;
    phone: string;
    phoneHint: string;
    logoLabel: string;
    logoHint: string;
    logoReplace: string;
    logoOptional: string;
    continueGoogle: string;
    continueFacebook: string;
    continueWhatsApp: string;
    or: string;
    email: string;
    password: string;
    passwordHint: string;
    continue: string;
    creating: string;
    noCard: string;
    haveAccount: string;
    logIn: string;
    termsBefore: string;
    termsLink: string;
    termsAnd: string;
    privacyLink: string;
    termsAfter: string;
    footer: string;
    errors: Record<string, string>;
  };
  controlTower: {
    eyebrow: string;
    title: string;
    description: string;
    waitingReply: string;
    waitingReplyHint: string;
    pendingStamps: string;
    pendingStampsHint: string;
    members: string;
    membersHint: string;
    prospects: string;
    prospectsHint: string;
    potential: string;
    potentialHint: string;
    reviews: string;
    reviewsHint: string;
    outlets: string;
    stampsMonth: string;
    stampsMonthHint: string;
    setupLoyalty: string;
    openInbox: string;
    openLoyalty: string;
    openCustomers: string;
    openBrands: string;
    openTraining: string;
    hqOn: string;
    hqOff: string;
    nextTitle: string;
    nextSetup: string;
    nextApprove: string;
    nextInbox: string;
    brands: string;
    inboxEmpty: string;
    queueEmpty: string;
    receipt: string;
    emptyTitle: string;
    emptyBody: string;
    live: string;
    mapsTitle: string;
    mapsMapped: string;
    mapsMappedHint: string;
    mapsNeedLook: string;
    mapsNeedLookHint: string;
    mapsReviews: string;
    mapsNote: string;
    mapsOpen: string;
    mapsConnect: string;
    googleOn: string;
    googleOff: string;
    periodTitle: string;
    liveTitle: string;
    preset7: string;
    preset28: string;
    presetMonth: string;
    rangeFrom: string;
    rangeTo: string;
    compare: string;
    vsPrior: string;
    stampsRange: string;
    stampsRangeHint: string;
    newMembers: string;
    newMembersHint: string;
    inboundChats: string;
    inboundChatsHint: string;
    newReviews: string;
    newReviewsHint: string;
  };
  settings: {
    eyebrow: string;
    badge: string;
    title: string;
    description: string;
    hubDescription: string;
    navOverview: string;
    navOverviewHint: string;
    navBranding: string;
    navBrandingHint: string;
    navApi: string;
    navApiHint: string;
    navPassword: string;
    navPasswordHint: string;
    navChatApps: string;
    navChatAppsHint: string;
    navGoogle: string;
    navGoogleHint: string;
    navPages: string;
    navPagesHint: string;
    hubPasswordBody: string;
    hubBrandingBody: string;
    hubChatAppsBody: string;
    hubGoogleBody: string;
    hubPagesBody: string;
    hubApiBody: string;
    hubApiMeta: string;
    openSection: string;
    agencyOnly: string;
    apiBadge: string;
    apiDescription: string;
    panel: string;
    scope: string;
    storage: string;
    language: string;
    languageHint: string;
    branding: string;
    appIdentity: string;
    appIdentityHint: string;
    messagingEn: string;
    messagingEnHint: string;
    messagingId: string;
    messagingIdHint: string;
    appName: string;
    monogram: string;
    logoImage: string;
    uploadLogo: string;
    clearLogo: string;
    logoHint: string;
    primaryColor: string;
    supportEmail: string;
    tagline: string;
    hero: string;
    narrative: string;
    promise: string;
    flow: string;
    flowHint: string;
    save: string;
    saving: string;
    reset: string;
    saved: string;
    saveFailed: string;
    logoNotImage: string;
    logoTooLarge: string;
  };
  brandStory: {
    brandPromise: string;
    growthFlow: string;
  };
  clients: {
    eyebrow: string;
    badge: string;
    title: string;
    description: string;
    newClient: string;
    total: string;
    loginOn: string;
    loginOff: string;
    empty: string;
    emptyHint: string;
    colName: string;
    colIndustry: string;
    colContact: string;
    colLogin: string;
    colUsers: string;
    colStatus: string;
    view: string;
    agencyOnly: string;
    followUp: string;
    followUpMenu: string;
    followUpTitle: string;
    followUpHint: string;
    followUpEmpty: string;
    followUpEmptyHint: string;
    selfServe: string;
    turnOnLogin: string;
    allBrands: string;
  };
  conversations: {
    eyebrow: string;
    badge: string;
    title: string;
    description: string;
    unreplied: string;
    search: string;
    filterAll: string;
    filterUnreplied: string;
    allLocations: string;
    colSource: string;
    filterSourceAll: string;
    colLast: string;
    colContact: string;
    colPreview: string;
    colBranch: string;
    colDirection: string;
    view: string;
    emptyNoMap: string;
    emptyWait: string;
    accountResponder: string;
    businessAppSource: string;
    historySync: string;
    handoffTakeover: string;
    handoffResume: string;
    handoffActive: string;
    agencyOnly: string;
    pickClient: string;
    pickClientHint: string;
    cardClients: string;
    cardBranches: string;
    cardChats: string;
    allClients: string;
    filterHq: string;
    filterBranch: string;
    filterTiktok: string;
    dirIn: string;
    dirOut: string;
    updated: string;
    replyHq: string;
    replyIg: string;
    replyFb: string;
    send: string;
    branchWatch: string;
    colAsset: string;
    filterSourceTitle: string;
    filterBranchTitle: string;
    openTitle: string;
    viaWebhook: string;
    sentFromApp: string;
    sendTitleFb: string;
    sendTitleIg: string;
    sendTitleHq: string;
    composerHintFb: string;
    composerHintIg: string;
    composerHintHq: string;
    attachFile: string;
    downloadFile: string;
    fileRemoved: string;
    sentConfirmFb: string;
    sentConfirmIg: string;
    sentConfirmHq: string;
    listeningWebhook: string;
    newViaWebhook: string;
    closeThread: string;
  };
  customers: {
    eyebrow: string;
    badge: string;
    title: string;
    description: string;
    search: string;
    withPhone: string;
    colPhone: string;
    colName: string;
    colBranch: string;
    colThreads: string;
    colLast: string;
    colStatus: string;
    colSource: string;
    colActiveAt: string;
    colStamps: string;
    colBirthday: string;
    colBirthdayWa: string;
    colEmail: string;
    colCity: string;
    colProvince: string;
    openChats: string;
    empty: string;
    emptyHint: string;
    agencyOnly: string;
    export: string;
    filterAllClients: string;
    filterAllBranches: string;
    colClient: string;
    pickClient: string;
    pickClientHint: string;
    cardClients: string;
    cardCustomers: string;
    cardBranches: string;
    allClients: string;
    peopleCount: string;
    statusAll: string;
    statusPotential: string;
    statusProspect: string;
    statusMember: string;
    chipPotential: string;
    chipProspect: string;
    chipMember: string;
    countPotential: string;
    countProspect: string;
    countMember: string;
    sourceJoinQr: string;
    sourceStaff: string;
    sourceHqChat: string;
    sourceBranchChat: string;
    yes: string;
    no: string;
    detailTitle: string;
    detailClose: string;
    detailJoined: string;
    detailActivated: string;
    detailChats: string;
    detailNoChat: string;
    detailExplainPotential: string;
    detailExplainProspect: string;
    detailExplainMember: string;
    detailOpen: string;
    hq: string;
    branch: string;
  };
  reports: {
    eyebrow: string;
    badge: string;
    title: string;
    description: string;
    pickBrand: string;
    noBrands: string;
    openMonth: string;
    tabLoyalty: string;
    tabOutlets: string;
    outletsTitle: string;
    outletsHint: string;
    colCity: string;
    colMapped: string;
    colReviews: string;
    colUnreplied: string;
    colReady: string;
    mappedYes: string;
    mappedNo: string;
    openOutlet: string;
    outletsEmpty: string;
    allBrands: string;
    toLoyalty: string;
    toSettings: string;
    heroKicker: string;
    withAtlasNow: string;
    membersReturned: string;
    membersReturnedHint: string;
    stampsThisMonth: string;
    stampsHint: string;
    receiptsThisMonth: string;
    receiptsHint: string;
    rewardsRedeemed: string;
    redeemHint: string;
    kindStamp: string;
    kindSpender: string;
    kindBirthday: string;
    topRegular: string;
    topRegularHint: string;
    topSpender: string;
    topSpenderHint: string;
    topEmpty: string;
    joined: string;
    joinedHint: string;
    activated: string;
    activatedHint: string;
    shoppers: string;
    shoppersHint: string;
    chipMembership: string;
    chipMembershipDetail: string;
    chipStamp: string;
    chipSpender: string;
    chipSpenderDetail: string;
    chipBirthday: string;
    chipBirthdayDetail: string;
    birthdayTitle: string;
    birthdayHint: string;
    birthdayEmpty: string;
    colWhen: string;
    colCode: string;
    colValue: string;
    stampRankTitle: string;
    stampRankHint: string;
    stampRankEmpty: string;
    colStamps: string;
    spenderTitle: string;
    spenderHint: string;
    spenderEmpty: string;
    outletTitle: string;
    outletHint: string;
    outletEmpty: string;
    colRank: string;
    colMember: string;
    colSpend: string;
    colReward: string;
    colOutlet: string;
    cardV1Title: string;
    cardV1Body: string;
    cardV1Cost: string;
  };
  broadcast: {
    eyebrow: string;
    title: string;
    description: string;
    brand: string;
    pickBrand: string;
    window: string;
    windowHint: string;
    opted: string;
    optedHint: string;
    hqOn: string;
    hqOff: string;
    noHq: string;
    connectHq: string;
    wabaHowTitle: string;
    wabaHowLead: string;
    wabaAtlasTitle: string;
    wabaAtlasBody: string;
    wabaSelfTitle: string;
    wabaSelfBody: string;
    wabaDont: string;
    wabaOpenChatApps: string;
    compose: string;
    placeholder: string;
    send: string;
    sending: string;
    sendHint: string;
    confirm: string;
    empty: string;
    resultOk: string;
    rulesTitle: string;
    rule1: string;
    rule2: string;
    rule3: string;
    laterBody: string;
    selectAll: string;
    selected: string;
    network: string;
    tabSession: string;
    tabTemplates: string;
    tabPayg: string;
    tabHistory: string;
    historyEmpty: string;
    historyEmptyHint: string;
    historyFoot: string;
    historyAttempted: string;
    historySent: string;
    historyDelivered: string;
    historyRead: string;
    historyFailed: string;
    historyAction: string;
    historyBirthday: string;
    historyLoading: string;
    recipients: string;
    optInList: string;
    sessionKind: string;
    marketingKind: string;
    utilityKind: string;
    estimate: string;
    metaCost: string;
    atlasFee: string;
    vat: string;
    total: string;
    perMessage: string;
    templatesTitle: string;
    templatesHint: string;
    goDealPreset: string;
    goDealPresetHint: string;
    birthdayPreset: string;
    birthdayPresetHint: string;
    createTemplate: string;
    templateName: string;
    templateBody: string;
    templateLang: string;
    category: string;
    submitted: string;
    approved: string;
    pending: string;
    rejected: string;
    sendTemplate: string;
    confirmTemplate: string;
    noTemplates: string;
    noOptIn: string;
    paygTitle: string;
    paygHint: string;
    paygMetaNote: string;
    example: string;
    attach: string;
    attachHint: string;
    attached: string;
    removeFile: string;
    uploading: string;
    headerSample: string;
    headerSampleHint: string;
    needsHeader: string;
    headerOnSend: string;
    editFees: string;
    feesLocked: string;
    stepWhat: string;
    stepWho: string;
    stepSend: string;
    sessionStepWho: string;
    sessionStepWhat: string;
    waitingMeta: string;
    noApproved: string;
    birthdayNotAuto: string;
    selectAllOpt: string;
    sendToN: string;
    whyNoTpl: string;
    whyNoPeople: string;
    whyNoHeader: string;
    whyNoConfirm: string;
    setupTitle: string;
    setupHint: string;
  };
  loyaltyDesk: {
    eyebrow: string;
    badge: string;
    title: string;
    description: string;
    training: string;
    monthReport: string;
    pickBrand: string;
    pickBrandHint: string;
    noBrands: string;
    openBrand: string;
    brand: string;
    notMember: string;
    notMemberHint: string;
    isMember: string;
    isMemberHint: string;
    tabQueue: string;
    tabSubmit: string;
    tabMember: string;
    tabScan: string;
    colOutlet: string;
    colPhone: string;
    colReceipt: string;
    colRp: string;
    colPhoto: string;
    queueEmpty: string;
    approve: string;
    reject: string;
    hqStamps: string;
    phoneMember: string;
    amount: string;
    reading: string;
    sendReceipt: string;
    checkPhoneTitle: string;
    checkPhoneHint: string;
    check: string;
    scanTitle: string;
    scanHint: string;
    notStampCard: string;
    redeemGo: string;
    pasteLink: string;
    open: string;
    fillReceipt: string;
    photoRequiredLabel: string;
    changePhoto: string;
    takePhoto: string;
    photoHint: string;
    photoAlt: string;
    match: string;
    mismatch: string;
    unreadable: string;
    photoRp: string;
    amountRequired: string;
    photoRequired: string;
    receiptRequired: string;
    receiptNos: string;
    receiptNosHint: string;
    stampRecorded: string;
    matchOffice: string;
    mismatchQueue: string;
    unreadableQueue: string;
    memberFound: string;
    goFailed: string;
    qrFailed: string;
    redeemGoOk: string;
    outlet: string;
    giftInSettings: string;
    lifeProspect: string;
    lifeMember: string;
    lifeNone: string;
    nextProspect: string;
    birthdayTitle: string;
    birthdayOff: string;
    birthdayWaitMember: string;
    birthdayWaitWindow: string;
    birthdayNeedWa: string;
    birthdayReady: string;
    birthdayRedeemed: string;
    birthdayCodePh: string;
    redeemBirthday: string;
    noOutlet: string;
    noOutletLink: string;
    stampTitle: string;
    checkEmpty: string;
    waBirthdayYes: string;
    goSample: string;
    goRecap: string;
    goRecapEmpty: string;
    goConnect: string;
    goPublicDemo: string;
    goChipOk: string;
    goChipWrong: string;
    goChipUsed: string;
    goChipTime: string;
  };
};

const en: Messages = {
  nav: {
    groups: {
      platform: "Platform",
      admin: "Brands",
      work: "Work",
      people: "People",
      reputation: "Reviews",
      places: "Places",
      insight: "Insight",
      learn: "Learn",
      later: "Later",
      workspace: "Account",
    },
    items: {
      "/agencies": {
        label: "Groups",
        description: "Every group on AtlasNow",
      },
      "/agencies/follow-up": {
        label: "Follow-up",
        description: "Groups, standalone brands, upgrades waiting",
      },
      "/support": {
        label: "Help desk",
        description: "AtlasNow support — Radit",
      },
      "/billing": {
        label: "Invoice",
        description: "Print invoice and SOW — transfer, no PPN, no gateway",
      },
      "/clients": {
        label: "Brands",
        description: "The restaurants and shops you manage",
      },
      "/clients/follow-up": {
        label: "Follow-up",
        description: "Sign-ups waiting for login",
      },
      "/deck_pitch": {
        label: "Pitch deck",
        description: "Client pitch — problems AtlasNow solves",
      },
      "/deck_train": {
        label: "Training",
        description: "Set up loyalty first, then how the till stamps",
      },
      "/activity": {
        label: "Change log",
        description: "Who changed what, and WhatsApp disconnects",
      },
      "/control-tower": {
        label: "Home",
        description: "Inbox, members, stamps, and what needs a person today",
      },
      "/leakage-queue": {
        label: "Needs a look",
        description: "Things that might lose a customer",
      },
      "/locations": {
        label: "Outlets",
        description: "Every branch, name, and map pin",
      },
      "/reputation": {
        label: "Reviews",
        description: "Read and reply to Google reviews",
      },
      "/posts": {
        label: "Posts",
        description: "Google posts and offers",
      },
      "/ads": {
        label: "Ads",
        description: "Promo and vouchers",
      },
      "/channels": {
        label: "Connected apps",
        description: "Facebook, Instagram, WhatsApp",
      },
      "/conversations": {
        label: "Inbox",
        description: "HQ WhatsApp — reply and membership",
      },
      "/broadcast": {
        label: "WhatsApp broadcast",
        description: "Write once to people who already messaged HQ",
      },
      "/commerce": {
        label: "Commerce",
        description: "Products for this brand. Catalog sync is off.",
      },
      "/yola": {
        label: "YOLA FUN",
        description: "Presale orders for this workspace. Sends and live payments stay off.",
      },
      "/customers": {
        label: "Customers",
        description: "Join QR members and people who messaged HQ or a branch",
      },
      "/loyalty": {
        label: "Loyalty",
        description: "Stamp cards and monthly top spender",
      },
      "/action-center": {
        label: "To-do",
        description: "Tasks for the team",
      },
      "/data-health": {
        label: "Connect Google",
        description: "Link Google Business Profile",
      },
      "/reports": {
        label: "Reports",
        description: "Loyalty this month",
      },
      "/settings": {
        label: "Settings",
        description: "Connections, name, language, and logins",
      },
    },
    logout: "Log out",
    activeTenant: "This brand",
    live: "Live",
    groupBadge: "Group",
    brandBadge: "Brand",
  },
  shell: {
    searchPlaceholder: "Inbox, members, outlets…",
    demoUi: "Demo UI",
  },
  login: {
    eyebrow: "Welcome back",
    signInTitle: "Sign in",
    signInHint: "Use the email you signed up with.",
    email: "Email",
    password: "Password",
    continue: "Continue",
    signingIn: "Signing in…",
    demoCredentials: "",
    loginFailed: "That email or password did not match.",
    networkError: "Network error",
    pendingActivation: "This brand login is not on yet. AtlasNow will follow up after you sign up.",
    accountDisabled: "This account is turned off. Write to hello@atlasnow.co.",
    phaseNote: "Login turns on after we follow up",
    phaseTip:
      "New accounts stay off until AtlasNow writes you. That is on purpose — not a broken login. Brand staff sign in here after that.",
    noAccount: "New here?",
    signUp: "Create an account",
    signUpTip:
      "Sign up first. Login stays off until AtlasNow follows up — you will not land in the desk yet.",
    or: "or",
    continueGoogle: "Continue with Google",
    continueFacebook: "Continue with Facebook",
    socialTip:
      "Google and Facebook only open this AtlasNow login. We do not post to your profile, and we do not keep that token for posting.",
    socialTermsBefore: "By continuing with Google or Facebook you agree to the",
    socialTermsLink: "Terms of Service",
    socialTermsAnd: "and",
    socialPrivacyLink: "Privacy Policy",
    socialTermsAfter: ".",
    cardFooter: "atlasnow.co · One desk for every location",
  },
  signup: {
    eyebrow: "Get started",
    title: "Create an account",
    hint: "This is one brand. Login stays off until we follow up — you will not land in the workspace yet.",
    nameBrand: "Brand name",
    wantsGroup: "I run more than one brand",
    wantsGroupHint: "Still one brand now. We open a group workspace after we talk.",
    phone: "WhatsApp number",
    phoneHint: "08 or +62. AtlasNow follows up here — tap Send on the next page.",
    logoLabel: "Brand logo",
    logoHint: "Upload a square logo",
    logoReplace: "Click to replace",
    logoOptional: "PNG or JPG · optional · shows on the join page",
    continueGoogle: "Continue with Google",
    continueFacebook: "Continue with Facebook",
    continueWhatsApp: "Continue with WhatsApp",
    or: "or",
    email: "Email",
    password: "Password",
    passwordHint: "At least 8 characters. This is how you sign in next time.",
    continue: "Continue",
    creating: "Sending…",
    noCard: "No credit card required",
    haveAccount: "Already have an account?",
    logIn: "Log in",
    termsBefore: "I agree to AtlasNow’s",
    termsLink: "Terms of Service",
    termsAnd: "and",
    privacyLink: "Privacy Policy",
    termsAfter: ". Required to create an account.",
    footer: "atlasnow.co · One desk for every location",
    errors: {
      terms_required: "Tick the box to agree to the Terms and Privacy Policy first.",
      phone_required: "Enter a WhatsApp number (08 or +62).",
      email_required: "Enter a valid email.",
      password_policy: "Password must be 8–80 characters.",
      email_taken: "That email already has an AtlasNow account. Log in instead.",
      too_many: "Too many new accounts right now. Try again in a bit.",
      signup_failed: "Could not create the workspace. Try again.",
      google_not_configured: "Google sign-up is not available yet. Use email, or write to hello@atlasnow.co.",
      facebook_not_configured: "Facebook sign-up is not available yet. Use email, or write to hello@atlasnow.co.",
      oauth_denied: "Sign-up was cancelled.",
      oauth_failed: "That sign-in did not finish. Try again, or use email.",
      facebook_email_required: "Facebook did not share an email. Allow email, or sign up with Google or email.",
      account_disabled: "This account is turned off. Write to hello@atlasnow.co.",
      no_workspace: "This login has no workspace yet. Write to hello@atlasnow.co.",
      whatsapp_unavailable:
        "WhatsApp is not used to create an AtlasNow account. Sign up with email, Google, or Facebook, then connect WhatsApp in Settings → Chat apps.",
      network: "Network error. Check your connection and try again.",
      invalid_json: "That request was not valid. Refresh and try again.",
    },
  },
  controlTower: {
    eyebrow: "Desk",
    title: "Home",
    description:
      "Pick a range. Stamps, new members, people who wrote, and new reviews sit in that window. Queues below are right now — not the range. Directions are not visits.",
    waitingReply: "Waiting reply",
    waitingReplyHint: "HQ or branch chat, last word was theirs",
    pendingStamps: "Receipts to approve",
    pendingStampsHint: "Stamp only after Approve",
    members: "Members",
    membersHint: "At least one approved receipt",
    prospects: "Prospects",
    prospectsHint: "prospects (joined, no stamp yet)",
    potential: "Potential",
    potentialHint: "Chatted, has not filled Join QR",
    reviews: "Reviews",
    reviewsHint: "Google reviews still without a reply",
    outlets: "Outlets",
    stampsMonth: "Stamps this month",
    stampsMonthHint: "Approved receipts only",
    setupLoyalty: "Set up loyalty",
    openInbox: "Inbox",
    openLoyalty: "Loyalty",
    openCustomers: "Customers",
    openBrands: "Brands",
    openTraining: "Training",
    hqOn: "Connected",
    hqOff: "Connect HQ WhatsApp",
    nextTitle: "Do these next",
    nextSetup: "Turn on the stamp card in Settings → Loyalty before the till starts.",
    nextApprove: "Approve {n} receipt(s) so stamps go live.",
    nextInbox: "Reply to {n} waiting chat(s).",
    brands: "Brands",
    inboxEmpty: "No chats waiting on you.",
    queueEmpty: "No receipts in the approve queue.",
    receipt: "Receipt",
    emptyTitle: "No brand on this desk yet",
    emptyBody: "Add a brand, then set Join QR, stamp card, and HQ WhatsApp.",
    live: "Live",
    mapsTitle: "Google listings",
    mapsMapped: "Mapped to Google",
    mapsMappedHint: "Outlets with an active Business Profile",
    mapsNeedLook: "Listings to check",
    mapsNeedLookHint: "Draft, partial, or blocked profiles",
    mapsReviews: "Reviews waiting",
    mapsNote: "Directions are visit intent, not visits. Full Maps metrics live on each outlet.",
    mapsOpen: "Outlet detail",
    mapsConnect: "Connect Google",
    googleOn: "Google connected",
    googleOff: "Google not connected",
    periodTitle: "In this range",
    liveTitle: "Right now",
    preset7: "7 days",
    preset28: "28 days",
    presetMonth: "This month",
    rangeFrom: "From",
    rangeTo: "To",
    compare: "Compare previous period",
    vsPrior: "vs prior",
    stampsRange: "Stamps",
    stampsRangeHint: "Approved till receipts in the range",
    newMembers: "New members",
    newMembersHint: "Joined in the range",
    inboundChats: "People who wrote",
    inboundChatsHint: "Unique chats with an inbound message",
    newReviews: "New reviews",
    newReviewsHint: "Google reviews that arrived — not Maps visits",
  },
  settings: {
    eyebrow: "Workspace",
    badge: "Configuration hub",
    title: "Settings",
    description:
      "Update app presentation — logo, bilingual brand copy, and growth flow. Changes apply to login, sidebar, and Control Tower.",
    hubDescription:
      "Workspace in one place: connect Google and chat apps, branding, language, and API keys.",
    navOverview: "Overview",
    navOverviewHint: "Hub & language",
    navBranding: "Branding",
    navBrandingHint: "Logo & product copy",
    navApi: "API Configuration",
    navApiHint: "Keys, OAuth, modes",
    navPassword: "Password",
    navPasswordHint: "Your login and team logins",
    navChatApps: "Chat apps",
    navChatAppsHint: "WhatsApp, Facebook, Instagram, TikTok",
    navGoogle: "Google",
    navGoogleHint: "Business Profile login and outlet match",
    navPages: "Pages",
    navPagesHint: "About, Contact, FAQ, social",
    hubPasswordBody:
      "Change your password. Super admins can also set a new password for any teammate or outlet user.",
    hubBrandingBody:
      "Logo, monogram, primary color, and bilingual messaging used across login, sidebar, and Control Tower.",
    hubChatAppsBody:
      "Connect WhatsApp HQ, branch WhatsApp, Messenger, Instagram, and TikTok. Pairing lives here — chats stay in Inbox.",
    hubGoogleBody:
      "Connect Google Business Profile, then match each Maps listing to the right outlet. Reviews and reply use this.",
    hubPagesBody:
      "Public About, Contact, and FAQ. Contact emails hello@atlasnow.co via Google Workspace.",
    hubApiBody:
      "Google Business Profile, Maps, WhatsApp, Meta, TikTok, Ads, Search Console — credentials and mock/live mode.",
    hubApiMeta: "configured or mock-ready",
    openSection: "Open",
    agencyOnly: "Agency staff only. Client users manage brand experience on Branding.",
    apiBadge: "Integrations",
    apiDescription:
      "Central registry for every external API. Save credentials here, then connect Google or chat apps from Settings.",
    panel: "Panel",
    scope: "Scope",
    storage: "Storage",
    language: "Interface language",
    languageHint: "English is the default product language. Switch to Bahasa Indonesia anytime.",
    branding: "Branding",
    appIdentity: "App identity",
    appIdentityHint: "Logo and name shown in sidebar, login, and shell.",
    messagingEn: "Messaging · English (primary)",
    messagingEnHint: "Canonical product language. Use this for decks, PRD, and sales.",
    messagingId: "Messaging · Bahasa Indonesia",
    messagingIdHint: "Optional localization when the interface language is set to ID.",
    appName: "App name",
    monogram: "Monogram letter",
    logoImage: "Logo image",
    uploadLogo: "Upload logo",
    clearLogo: "Clear logo",
    logoHint: "PNG / JPG / WebP · max ~600KB",
    primaryColor: "Primary color",
    supportEmail: "Support email",
    tagline: "Tagline",
    hero: "Hero headline",
    narrative: "Supporting narrative",
    promise: "Core product promise",
    flow: "Growth flow (one step per line)",
    flowHint: "Default: Optimize location assets → … → Generate measurable outcomes",
    save: "Save branding",
    saving: "Saving…",
    reset: "Reset form",
    saved: "Branding saved. UI refreshed.",
    saveFailed: "Save failed",
    logoNotImage: "File must be an image (PNG, JPG, SVG, WebP).",
    logoTooLarge: "Logo max ~600KB. Compress first or use a monogram.",
  },
  brandStory: {
    brandPromise: "Brand promise",
    growthFlow: "Growth flow",
  },
  clients: {
    eyebrow: "Agency admin",
    badge: "Client database",
    title: "Clients",
    description:
      "Create brand clients, store contact data, and activate workspace login when ready.",
    newClient: "New client",
    total: "Total clients",
    loginOn: "Login active",
    loginOff: "Login inactive",
    empty: "No clients yet",
    emptyHint: "Add your first brand client to start managed-service onboarding.",
    colName: "Client",
    colIndustry: "Industry",
    colContact: "Contact",
    colLogin: "Login",
    colUsers: "Users",
    colStatus: "Status",
    view: "Open",
    agencyOnly: "This area is for agency staff only.",
    followUp: "Needs follow-up",
    followUpMenu: "Open follow-up list",
    followUpTitle: "Waiting for activation",
    followUpHint:
      "Self-serve sign-ups and brands with login still off. Talk to them, then turn login on — they do not enter the dashboard until you do.",
    followUpEmpty: "Nothing waiting",
    followUpEmptyHint: "New sign-ups and brands with login off will show up here.",
    selfServe: "Signed up on the site",
    turnOnLogin: "Turn on login",
    allBrands: "All brands",
  },
  conversations: {
    eyebrow: "Inbox",
    badge: "Live",
    title: "Conversations",
    description:
      "Reply from WhatsApp HQ, Messenger, and Instagram. Branch WhatsApp is watch-only — reply on the store phone.",
    unreplied: "unreplied",
    search: "Search name, phone, or text…",
    filterAll: "All",
    filterUnreplied: "Unreplied",
    allLocations: "All branches",
    colSource: "Source",
    filterSourceAll: "All sources",
    colLast: "Last",
    colContact: "Contact",
    colPreview: "Preview",
    colBranch: "Branch",
    colDirection: "Status",
    view: "Open",
    emptyNoMap: "Map this channel on Chat apps (WhatsApp HQ, Messenger, Instagram, TikTok) or the outlet Sources tab.",
    emptyWait: "Waiting for messages.",
    accountResponder: "Account responder",
    businessAppSource: "WhatsApp Business App",
    historySync: "History sync",
    handoffTakeover: "Take over",
    handoffResume: "Resume automation",
    handoffActive: "A person is handling this chat. Automation stays quiet until you resume it or the handoff expires.",
    agencyOnly: "Staff monitor conversations.",
    pickClient: "Pick a brand",
    pickClientHint: "Open a brand to see HQ and branch chats.",
    cardClients: "Clients",
    cardBranches: "Branches",
    cardChats: "Chats",
    allClients: "All brands",
    filterHq: "WhatsApp HQ",
    filterBranch: "Branch WhatsApp",
    filterTiktok: "TikTok",
    dirIn: "In",
    dirOut: "Replied",
    updated: "Updated",
    replyHq: "Reply from HQ…",
    replyIg: "Reply on Instagram…",
    replyFb: "Reply on Messenger…",
    send: "Send",
    branchWatch: "This is a branch number. Reply on the store phone. Atlas only sends from WhatsApp HQ.",
    colAsset: "Page / account",
    filterSourceTitle:
      "Filter by channel. Messenger is the connected Facebook Page. Instagram is the Professional account linked to that Page.",
    filterBranchTitle: "Filter conversations by the branch this Page or account is mapped to.",
    openTitle: "Open this conversation to reply from AtlasNow",
    viaWebhook: "Received via webhook",
    sentFromApp: "Sent from AtlasNow",
    sendTitleFb: "Send this reply to the customer on Messenger",
    sendTitleIg: "Send this reply to the customer on Instagram",
    sendTitleHq: "Send this reply to the customer on WhatsApp HQ",
    composerHintFb:
      "Live send to Messenger. The same text should appear in the native Messenger app.",
    composerHintIg:
      "Live send to Instagram. The same text should appear in the native Instagram app.",
    composerHintHq: "Live send from WhatsApp HQ to the customer’s WhatsApp.",
    attachFile: "Attach",
    downloadFile: "Download",
    fileRemoved: "File removed after the retention period.",
    sentConfirmFb: "Sent to Messenger. Confirm the same text in the native Messenger app.",
    sentConfirmIg: "Sent to Instagram. Confirm the same text in the native Instagram app.",
    sentConfirmHq: "Sent to WhatsApp HQ.",
    listeningWebhook: "Listening for new messages on this Page via webhook.",
    newViaWebhook: "New · webhook",
    closeThread: "Close conversation",
  },
  customers: {
    eyebrow: "Demand",
    badge: "People book",
    title: "Customers",
    description:
      "Join QR, HQ chat, and branch chat in one book. A prospect becomes a member only after the first approved receipt that meets the brand minimum. Export is not a blast list.",
    search: "Search name, phone, or email…",
    withPhone: "with phone",
    colPhone: "Phone",
    colName: "Name",
    colBranch: "Branch",
    colThreads: "Threads",
    colLast: "Last seen",
    colStatus: "Status",
    colSource: "Source",
    colActiveAt: "Active at",
    colStamps: "Stamps",
    colBirthday: "Birthday",
    colBirthdayWa: "Birthday WA",
    colEmail: "Email",
    colCity: "City",
    colProvince: "Province",
    openChats: "Chats",
    empty: "No people yet.",
    emptyHint: "Print the join QR in Settings → Loyalty, or wait for a WhatsApp message to HQ or a branch.",
    agencyOnly: "Agency staff manage the customer book.",
    export: "Export CSV",
    filterAllClients: "All clients",
    filterAllBranches: "All branches",
    colClient: "Client",
    pickClient: "Pick a brand",
    pickClientHint: "Open a brand to see join-QR members and people who messaged HQ or a branch.",
    cardClients: "Brands",
    cardCustomers: "People",
    cardBranches: "Branches",
    allClients: "All brands",
    peopleCount: "{n} people",
    statusAll: "All statuses",
    statusPotential: "Potential",
    statusProspect: "Prospect",
    statusMember: "Member",
    chipPotential: "Potential",
    chipProspect: "Prospect",
    chipMember: "Member",
    countPotential: "{n} potential",
    countProspect: "{n} prospect",
    countMember: "{n} member",
    sourceJoinQr: "Join QR",
    sourceStaff: "Staff",
    sourceHqChat: "HQ chat",
    sourceBranchChat: "Branch chat",
    yes: "Yes",
    no: "No",
    detailTitle: "Customer",
    detailClose: "Close",
    detailJoined: "Joined",
    detailActivated: "Became a member at",
    detailChats: "WhatsApp",
    detailNoChat: "No HQ or branch chat yet.",
    detailExplainPotential:
      "They messaged HQ or a branch. Not a member until they fill the join QR.",
    detailExplainProspect:
      "They filled the join QR. Membership starts after the first approved receipt that meets the brand minimum.",
    detailExplainMember:
      "First qualifying receipt is approved. Stamp card and birthday gift can apply.",
    detailOpen: "Open profile",
    hq: "HQ",
    branch: "Branch",
  },
  reports: {
    eyebrow: "Reports",
    badge: "Loyalty · this month",
    title: "Loyalty this month",
    description:
      "Numbers come from approved receipts, stamps, and gifts handed over at the till. Not visits, not scans, not Cirqle.",
    pickBrand: "Pick a brand. Each brand has its own stamp card, top spenders, and birthday program.",
    noBrands: "No brands yet. Add one under Brands.",
    openMonth: "Open this month’s loyalty",
    tabLoyalty: "Loyalty",
    tabOutlets: "Outlets",
    outletsTitle: "Google listings by outlet",
    outletsHint:
      "High-level listing health. Open an outlet for Maps impressions, calls, and direction requests — never counted as visits.",
    colCity: "City",
    colMapped: "Google",
    colReviews: "Reviews",
    colUnreplied: "Waiting reply",
    colReady: "Profile",
    mappedYes: "Mapped",
    mappedNo: "Not mapped",
    openOutlet: "Open",
    outletsEmpty: "No outlets yet.",
    allBrands: "All brands",
    toLoyalty: "Loyalty desk",
    toSettings: "Program settings",
    heroKicker: "Your loyalty program this month",
    withAtlasNow: "Your month with AtlasNow",
    membersReturned: "Members returned",
    membersReturnedHint: "People with a valid receipt this month who already had one before. First-timers sit in Activated.",
    stampsThisMonth: "Stamps this month",
    stampsHint: "1 approved receipt that meets the brand minimum = 1 stamp. Not a visit counter.",
    receiptsThisMonth: "Receipts this month",
    receiptsHint: "Approved receipts this month. Stamp card is off — these still feed top spender.",
    rewardsRedeemed: "Rewards redeemed",
    redeemHint: "Gifts the cashier marked Redeem. Not a promise in chat.",
    kindStamp: "stamp",
    kindSpender: "top spender",
    kindBirthday: "birthday",
    topRegular: "Top regular",
    topRegularHint: "Most stamps this month.",
    topSpender: "Top spender",
    topSpenderHint: "Highest qualifying spend this month.",
    topEmpty: "No qualifying receipts this month.",
    joined: "Joined",
    joinedHint: "Filled the membership QR this month. Still calon until a valid receipt.",
    activated: "Activated",
    activatedHint: "First valid receipt this month. That is when membership turns aktif.",
    shoppers: "Shopped",
    shoppersHint: "Unique members with at least one approved receipt this month.",
    chipMembership: "Membership",
    chipMembershipDetail: "QR join · aktif after first receipt",
    chipStamp: "Stamp card",
    chipSpender: "Top spender",
    chipSpenderDetail: "Top {n} this month",
    chipBirthday: "Birthday",
    chipBirthdayDetail: "Once a year at the till — WhatsApp code required",
    birthdayTitle: "Birthday redemptions",
    birthdayHint: "Cashier typed the WhatsApp code. One per member per year.",
    birthdayEmpty: "No birthday codes redeemed this month.",
    colWhen: "When",
    colCode: "Code",
    colValue: "Value",
    stampRankTitle: "Stamp ranking this month",
    stampRankHint: "Most qualifying stamps this month. Not lifetime card progress.",
    stampRankEmpty: "No stamps this month.",
    colStamps: "Stamps",
    spenderTitle: "Top spenders this month",
    spenderHint: "Qualifying spend on approved receipts. Rank 1 only gets rank 1’s gift. Table shows the top 20.",
    spenderEmpty: "No qualifying spend this month.",
    outletTitle: "By outlet",
    outletHint: "Stamps or receipts recorded at each branch this month.",
    outletEmpty: "No approved receipts this month.",
    colRank: "Place",
    colMember: "Member",
    colSpend: "Spend",
    colReward: "Gets",
    colOutlet: "Outlet",
    cardV1Title: "Where the member shows the stamp card (v1)",
    cardV1Body:
      "They chat the HQ WhatsApp number: Status Stamp / Cek Stamp. Atlas replies with the live card. The cashier can also type the phone on Loyalty → Cek member. A stamp QR on the phone comes later.",
    cardV1Cost:
      "Customer writes first, so the reply sits in the 24-hour service window — not a marketing template. Connect the official HQ number in Chat apps.",
  },
  broadcast: {
    eyebrow: "HQ WhatsApp",
    title: "Broadcast",
    description:
      "Choose the message, choose the people, then send. A service reply only goes to people who wrote your HQ number in the last day. A template only goes to people who said yes to WhatsApp when they joined — not a list you uploaded. Birthday wishes go out on their own, once a year.",
    brand: "Brand",
    pickBrand: "Pick a brand",
    window: "Open window",
    windowHint: "Wrote HQ in the last 24 hours — service message, not a template",
    opted: "Birthday opt-in",
    optedHint: "Ticked birthday WhatsApp on join. H-2 auto sends birthday_greeting once a year. You can still send a template now.",
    hqOn: "Connected",
    hqOff: "Not connected",
    noHq: "Connect the official HQ WhatsApp first.",
    connectHq: "Chat apps",
    wabaHowTitle: "How to connect HQ WhatsApp",
    wabaHowLead:
      "Blast, loyalty, and the HQ inbox all use one official business number — not a branch phone.",
    wabaAtlasTitle: "Atlas connects it for you",
    wabaAtlasBody:
      "Usual path. Send us the brand HQ number. P2P Labs registers it on WhatsApp Cloud and pastes it in Chat apps. You don’t need a Meta developer login.",
    wabaSelfTitle: "The brand connects it themselves",
    wabaSelfBody:
      "In Meta Business Suite → WhatsApp Manager, create a WhatsApp Business Account and add that HQ number. Copy Phone number ID, WABA ID, and a permanent access token (Meta calls it a system user token). Paste those three in Settings → Chat apps. Our webhook is already https://atlasnow.co/api/webhooks/whatsapp.",
    wabaDont: "Don’t scan a QR for HQ. Don’t use a store WhatsApp. One number can’t be Cloud API and a phone QR at the same time.",
    wabaOpenChatApps: "Open Chat apps",
    compose: "Message",
    placeholder: "Keep it a service note. This is not a promo template.",
    send: "Send to selected",
    sending: "Sending…",
    sendHint: "Up to {max} people per send. Each one must still be inside the 24-hour window.",
    confirm: "I understand this goes to people who already wrote HQ, not a purchased list.",
    empty: "Nobody wrote HQ in the last 24 hours.",
    resultOk: "Sent {n}. Failed {f}.",
    rulesTitle: "The rules",
    rule1: "No CSV upload. Export from Customers is a book, not a blast list.",
    rule2: "Service reply: only the 24-hour window after they write HQ. That window is who, not a free Meta price.",
    rule3: "Templates: only people who ticked birthday WhatsApp on join. STOP drops them. Not automatic — you press send.",
    laterBody: "A marketing template to opted-in members is not this button. This button is a service note to people already in the chat.",
    selectAll: "Select window",
    selected: "{n} selected · max {max}",
    network: "Network error. Try again.",
    tabSession: "Service",
    tabTemplates: "Templates",
    tabPayg: "Pay as you go",
    tabHistory: "History",
    historyEmpty: "No HQ sends yet.",
    historyEmptyHint: "Statuses appear after Meta calls us back — not at the Send click.",
    historyFoot: "Read only counts people with read receipts on. Action = they wrote HQ or tapped a template button. Not visits, not URL clicks.",
    historyAttempted: "Attempted",
    historySent: "Sent",
    historyDelivered: "Delivered",
    historyRead: "Read",
    historyFailed: "Failed",
    historyAction: "Action",
    historyBirthday: "Birthday H-2",
    historyLoading: "Loading…",
    recipients: "Recipients",
    optInList: "Birthday opt-in",
    sessionKind: "Service",
    marketingKind: "Marketing",
    utilityKind: "Utility",
    estimate: "Estimate",
    metaCost: "Meta (rate card)",
    atlasFee: "AtlasNow fee",
    vat: "PPN 11% estimate",
    total: "Quoted total",
    perMessage: "per message",
    templatesTitle: "HSM templates",
    templatesHint:
      "Step 1 pick an approved template. Step 2 tick who. Step 3 send. Only APPROVED can send. Audience is birthday-opt-in on the join form — not a CSV, not TikTok phones.",
    goDealPreset: "Fill TikTok GO deal template",
    goDealPresetHint:
      "MARKETING. Variables: name, brand, voucher, outlet. Buy on TikTok, QR at till, this chat is not the voucher, STOP.",
    birthdayPreset: "Fill birthday_greeting template",
    birthdayPresetHint:
      "Same body for every brand. Atlas fills {{customer_name}} (join form), {{voucher_number}} (Loyalty → Birthday Reward), {{code_voucher}} (unique per member/year). Meta still reviews it on this WABA.",
    createTemplate: "Submit to Meta",
    templateName: "Name (lowercase_underscore)",
    templateBody: "Body",
    templateLang: "Language",
    category: "Category",
    submitted: "Submitted to Meta",
    approved: "Approved",
    pending: "Pending review",
    rejected: "Rejected",
    sendTemplate: "Send approved template",
    confirmTemplate: "I understand this is a paid template to people who opted in — not a purchased list.",
    noTemplates: "No templates on this WABA yet. Submit one below.",
    noOptIn: "Nobody ticked birthday WhatsApp on the join form.",
    paygTitle: "Pay as you go",
    paygHint:
      "Estimates use Meta’s 1 Oct 2026 IDR rate card (recipient country sets the rate; Indonesia marketing Rp 586.33, utility/service Rp 356.65 on that card). AtlasNow adds a platform fee on top. Human session notes are service messages: first 1,000 delivered per business number per month are Meta-free, then Meta’s utility rate for that recipient. This screen is an estimate. Confirm the invoice in WhatsApp Manager.",
    paygMetaNote: "CSV rates are exclusive of VAT. If Meta invoices in Indonesia, PPN 11% may apply on the Meta line.",
    example: "Examples",
    attach: "Image or PDF",
    attachHint: "JPEG, PNG, WebP up to 5 MB. PDF up to 16 MB. Caption is optional.",
    attached: "Attached",
    removeFile: "Remove",
    uploading: "Uploading to WhatsApp…",
    headerSample: "Header sample (image or PDF)",
    headerSampleHint:
      "If you attach a file, Meta reviews it as the template header. When you send, attach the live file again.",
    needsHeader: "This template needs a header image or PDF.",
    headerOnSend: "Header file for this send",
    editFees: "Edit Atlas fee / margin → Settings",
    feesLocked: "Atlas fee is set by Super Admin.",
    stepWhat: "1 · What to send",
    stepWho: "2 · Who",
    stepSend: "3 · Send",
    sessionStepWho: "1 · Who (wrote HQ in last 24h)",
    sessionStepWhat: "2 · What",
    waitingMeta: "Not approved — cannot send yet",
    noApproved: "No approved template yet. Submit one below, then wait for Meta.",
    birthdayNotAuto:
      "Join-form tick. H-2 auto sends birthday_greeting once a year to aktif members. This list is also the manual send. STOP drops them.",
    selectAllOpt: "Select all",
    sendToN: "Send to {n} numbers",
    whyNoTpl: "Pick an approved template.",
    whyNoPeople: "Pick at least one number.",
    whyNoHeader: "This template needs a header image or PDF first.",
    whyNoConfirm: "Tick the confirmation below.",
    setupTitle: "New template for Meta",
    setupHint: "This is not a send. Meta reviews it. After APPROVED it shows in step 1.",
  },
  loyaltyDesk: {
    eyebrow: "Loyalty",
    badge: "No Cloud API required to record stamps",
    title: "Till",
    description:
      "Look up the guest, take a photo of the struk, then stamp. Birthday code only in the birthday window, after they are a member.",
    training: "Training",
    monthReport: "This month’s report",
    pickBrand: "Pick a brand. Each brand has its own stamp card and top spender.",
    pickBrandHint: "Open queue, submit, redeem",
    noBrands: "No brands yet. Add one under Brands.",
    openBrand: "Open queue, submit, redeem",
    brand: "Brand",
    notMember: "Not a member",
    notMemberHint: "Give the join QR (Settings → Loyalty). Phone + name. Then they are a prospect.",
    isMember: "Already a member",
    isMemberHint: "Check phone, or Scan QR on the customer’s card.",
    tabQueue: "Queue",
    tabSubmit: "Submit receipt",
    tabMember: "Check phone",
    tabScan: "Scan QR",
    colOutlet: "Outlet",
    colPhone: "Phone",
    colReceipt: "Receipt no.",
    colRp: "Rp",
    colPhoto: "Photo",
    queueEmpty: "No queue. MATCH auto-stamps. Here: blurry, mismatch, or audit mode.",
    approve: "Approve",
    reject: "Reject",
    hqStamps: "HQ stamps this",
    phoneMember: "Member phone",
    amount: "Amount (Rp)",
    reading: "Reading receipt…",
    sendReceipt: "Send receipt",
    checkPhoneTitle: "Look up phone",
    checkPhoneHint: "Type the number they used on the join form. Stamp QR is the Scan QR tab — not the table sticker.",
    check: "Check",
    scanTitle: "Scan stamp QR or TikTok GO",
    scanHint: "Member stamp QR, or TikTok GO voucher (starts TT-). Not the join sticker on the table.",
    notStampCard: "not a stamp card",
    redeemGo: "Redeem TikTok GO voucher",
    pasteLink: "Paste card link",
    open: "Open",
    fillReceipt: "Fill in the receipt",
    photoRequiredLabel: "Receipt photo (required)",
    changePhoto: "Replace photo",
    takePhoto: "Take a photo of the paper",
    photoHint: "Whole paper, enough light. Not a chat screenshot.",
    photoAlt: "Receipt",
    match: "Match",
    mismatch: "Mismatch",
    unreadable: "Unreadable",
    photoRp: "Photo Rp",
    amountRequired: "Amount is required. Use Rp from the till paper.",
    photoRequired: "Receipt photo is required.",
    receiptRequired: "Enter transaction / receipt / invoice no.",
    receiptNos: "Transaction / receipt / invoice no.",
    receiptNosHint: "From the till paper. Machines use different names — enter the printed number.",
    stampRecorded: "Stamp recorded. Number and Rp on the photo match.",
    matchOffice: "Photo matches. Office checks all — waiting for Approve.",
    mismatchQueue: "Photo and till numbers differ. In the office queue.",
    unreadableQueue: "Photo unreadable. Receipt in the office queue. No stamp yet.",
    memberFound: "Member found. Enter the receipt number below. No stamp until Approve.",
    goFailed: "TikTok GO QR failed",
    qrFailed: "QR failed",
    redeemGoOk: "TikTok GO voucher redeemed at {name}. Not a stamp.",
    outlet: "Outlet",
    giftInSettings: "Gift in brand settings",
    lifeProspect: "Prospect",
    lifeMember: "Member",
    lifeNone: "Not on the list",
    nextProspect: "Send a receipt. The first approved ticket makes them a member — then stamps and birthday.",
    birthdayTitle: "Birthday",
    birthdayOff: "Birthday gift is off in Settings → Loyalty.",
    birthdayWaitMember: "Birthday after the first approved receipt.",
    birthdayWaitWindow: "Not in the birthday window (2 days before through 7 days after).",
    birthdayNeedWa: "WhatsApp has not sent the code yet.",
    birthdayReady: "Guest shows the chat. Type that code — don’t invent it.",
    birthdayRedeemed: "Already redeemed this year.",
    birthdayCodePh: "BDY26-XXXX",
    redeemBirthday: "Redeem birthday",
    noOutlet: "No store outlet on this brand. Add one in Outlets before a receipt.",
    noOutletLink: "Open Outlets",
    stampTitle: "Stamp card",
    checkEmpty: "Check a phone to see the member, stamps, birthday, and the receipt form.",
    waBirthdayYes: "WhatsApp birthday: yes",
    goSample: "Sample QR — does not call TikTok. Live TT- QR needs Chat apps → TikTok GO till.",
    goRecap: "TikTok GO tebus (this brand)",
    goRecapEmpty: "No tebus yet. Try a sample QR, then Tebus.",
    goConnect: "Connect TikTok GO",
    goPublicDemo: "Public demo",
    goChipOk: "Valid voucher",
    goChipWrong: "Wrong outlet",
    goChipUsed: "Already used",
    goChipTime: "Outside hours",
  },
};

const id: Messages = {
  nav: {
    groups: {
      platform: "Platform",
      admin: "Merek",
      work: "Kerja",
      people: "Orang",
      reputation: "Ulasan",
      places: "Cabang",
      insight: "Laporan",
      learn: "Pelatihan",
      later: "Nanti",
      workspace: "Akun",
    },
    items: {
      "/agencies": {
        label: "Grup",
        description: "Semua grup di AtlasNow",
      },
      "/agencies/follow-up": {
        label: "Follow-up",
        description: "Grup, merek mandiri, pengajuan upgrade",
      },
      "/support": {
        label: "Help desk",
        description: "Support AtlasNow — Radit",
      },
      "/billing": {
        label: "Invoice",
        description: "Print invoice dan SOW — transfer, tanpa PPN, tanpa gateway",
      },
      "/clients": {
        label: "Merek",
        description: "Resto dan toko yang kamu pegang",
      },
      "/clients/follow-up": {
        label: "Follow-up",
        description: "Daftar yang menunggu login dinyalakan",
      },
      "/deck_pitch": {
        label: "Pitch deck",
        description: "Pitch ke klien — masalah yang AtlasNow selesaikan",
      },
      "/deck_train": {
        label: "Pelatihan",
        description: "Pasang loyalty dulu, baru cara kasir cap stamp",
      },
      "/activity": {
        label: "Log perubahan",
        description: "Siapa mengubah apa, dan WhatsApp putus",
      },
      "/control-tower": {
        label: "Beranda",
        description: "Inbox, member, stamp, dan yang perlu orang hari ini",
      },
      "/leakage-queue": {
        label: "Perlu diurus",
        description: "Hal yang bisa bikin pelanggan pergi",
      },
      "/locations": {
        label: "Cabang",
        description: "Semua outlet, nama, dan pin peta",
      },
      "/reputation": {
        label: "Ulasan",
        description: "Baca dan balas ulasan Google",
      },
      "/posts": {
        label: "Postingan",
        description: "Post dan promo Google",
      },
      "/ads": {
        label: "Iklan",
        description: "Promo dan voucher",
      },
      "/channels": {
        label: "Aplikasi terhubung",
        description: "Facebook, Instagram, WhatsApp",
      },
      "/conversations": {
        label: "Inbox",
        description: "WhatsApp HQ — balas dan membership",
      },
      "/broadcast": {
        label: "Broadcast WhatsApp",
        description: "Tulis sekali ke orang yang sudah chat HQ",
      },
      "/commerce": {
        label: "Commerce",
        description: "Produk merek ini. Sinkron katalog belum nyala.",
      },
      "/yola": {
        label: "YOLA FUN",
        description: "Order presale workspace ini. Pengiriman dan pembayaran live tetap mati.",
      },
      "/customers": {
        label: "Pelanggan",
        description: "Member QR daftar dan yang chat HQ atau cabang",
      },
      "/loyalty": {
        label: "Loyalty",
        description: "Kartu stamp dan top spender bulanan",
      },
      "/action-center": {
        label: "Tugas",
        description: "Pekerjaan tim hari ini",
      },
      "/data-health": {
        label: "Hubungkan Google",
        description: "Sambungkan Google Business Profile",
      },
      "/reports": {
        label: "Laporan",
        description: "Loyalty bulan ini",
      },
      "/settings": {
        label: "Pengaturan",
        description: "Koneksi, nama, bahasa, dan login",
      },
    },
    logout: "Keluar",
    activeTenant: "Merek ini",
    live: "Live",
    groupBadge: "Grup",
    brandBadge: "Merek",
  },
  shell: {
    searchPlaceholder: "Inbox, member, cabang…",
    demoUi: "UI Demo",
  },
  login: {
    eyebrow: "Selamat datang",
    signInTitle: "Masuk",
    signInHint: "Pakai email yang dipakai saat daftar.",
    email: "Email",
    password: "Kata sandi",
    continue: "Lanjut",
    signingIn: "Sedang masuk…",
    demoCredentials: "",
    loginFailed: "Email atau kata sandi tidak cocok.",
    networkError: "Kesalahan jaringan",
    pendingActivation: "Login merek ini belum dinyalakan. AtlasNow akan follow up setelah kamu daftar.",
    accountDisabled: "Akun ini dimatikan. Tulis ke hello@atlasnow.co.",
    phaseNote: "Login nyala setelah kami follow up",
    phaseTip:
      "Akun baru tetap mati sampai AtlasNow menulis. Itu disengaja — bukan login rusak. Staf merek masuk di sini setelah itu.",
    noAccount: "Belum punya akun?",
    signUp: "Buat akun",
    signUpTip:
      "Daftar dulu. Login tetap mati sampai AtlasNow follow up — kamu belum masuk ke meja kerja.",
    or: "atau",
    continueGoogle: "Lanjut dengan Google",
    continueFacebook: "Lanjut dengan Facebook",
    socialTip:
      "Google dan Facebook hanya membuka login AtlasNow ini. Kami tidak memposting ke profilmu, dan token itu tidak disimpan untuk posting.",
    socialTermsBefore: "Dengan lanjut pakai Google atau Facebook, kamu setuju dengan",
    socialTermsLink: "Syarat Layanan",
    socialTermsAnd: "dan",
    socialPrivacyLink: "Kebijakan Privasi",
    socialTermsAfter: ".",
    cardFooter: "atlasnow.co · Satu meja untuk setiap lokasi",
  },
  signup: {
    eyebrow: "Mulai",
    title: "Buat akun",
    hint: "Ini satu merek. Login belum nyala sampai kami follow up — kamu belum masuk workspace.",
    nameBrand: "Nama merek",
    wantsGroup: "Saya pegang lebih dari satu merek",
    wantsGroupHint: "Tetap satu merek sekarang. Workspace grup setelah kami bicara.",
    phone: "Nomor WhatsApp",
    phoneHint: "08 atau +62. AtlasNow follow up ke sini — tekan Send di halaman berikutnya.",
    logoLabel: "Logo merek",
    logoHint: "Unggah logo persegi",
    logoReplace: "Klik untuk ganti",
    logoOptional: "PNG atau JPG · opsional · tampil di halaman daftar",
    continueGoogle: "Lanjut dengan Google",
    continueFacebook: "Lanjut dengan Facebook",
    continueWhatsApp: "Lanjut dengan WhatsApp",
    or: "atau",
    email: "Email",
    password: "Kata sandi",
    passwordHint: "Minimal 8 karakter. Ini cara masuk berikutnya.",
    continue: "Lanjut",
    creating: "Mengirim…",
    noCard: "Tidak perlu kartu kredit",
    haveAccount: "Sudah punya akun?",
    logIn: "Masuk",
    termsBefore: "Saya setuju dengan",
    termsLink: "Syarat Layanan",
    termsAnd: "dan",
    privacyLink: "Kebijakan Privasi",
    termsAfter: " AtlasNow. Wajib untuk membuat akun.",
    footer: "atlasnow.co · Satu meja untuk setiap lokasi",
    errors: {
      terms_required: "Centang dulu persetujuan Syarat dan Kebijakan Privasi.",
      phone_required: "Masukkan nomor WhatsApp (08 atau +62).",
      email_required: "Masukkan email yang valid.",
      password_policy: "Kata sandi harus 8–80 karakter.",
      email_taken: "Email ini sudah punya akun AtlasNow. Masuk saja.",
      too_many: "Terlalu banyak akun baru saat ini. Coba lagi sebentar.",
      signup_failed: "Workspace belum berhasil dibuat. Coba lagi.",
      google_not_configured: "Daftar dengan Google belum tersedia. Pakai email, atau tulis ke hello@atlasnow.co.",
      facebook_not_configured: "Daftar dengan Facebook belum tersedia. Pakai email, atau tulis ke hello@atlasnow.co.",
      oauth_denied: "Pendaftaran dibatalkan.",
      oauth_failed: "Masuk lewat itu tidak selesai. Coba lagi, atau pakai email.",
      facebook_email_required: "Facebook tidak membagikan email. Izinkan email, atau daftar dengan Google atau email.",
      account_disabled: "Akun ini dimatikan. Tulis ke hello@atlasnow.co.",
      no_workspace: "Login ini belum punya workspace. Tulis ke hello@atlasnow.co.",
      whatsapp_unavailable:
        "WhatsApp tidak dipakai untuk membuat akun AtlasNow. Daftar dengan email, Google, atau Facebook, lalu sambungkan WhatsApp di Pengaturan → Aplikasi chat.",
      network: "Jaringan error. Cek koneksi dan coba lagi.",
      invalid_json: "Permintaan tidak valid. Refresh lalu coba lagi.",
    },
  },
  controlTower: {
    eyebrow: "Meja kerja",
    title: "Beranda",
    description:
      "Pilih rentang. Stamp, member baru, orang yang menulis, dan ulasan baru di jendela itu. Antrian di bawah adalah sekarang — bukan rentang. Minta arah bukan kunjungan.",
    waitingReply: "Menunggu balasan",
    waitingReplyHint: "Chat HQ atau cabang, kata terakhir dari mereka",
    pendingStamps: "Struk menunggu Approve",
    pendingStampsHint: "Stamp hanya setelah Approve",
    members: "Member",
    membersHint: "Minimal satu struk disetujui",
    prospects: "Calon",
    prospectsHint: "calon (sudah daftar, belum stamp)",
    potential: "Potensi",
    potentialHint: "Sudah chat, belum isi QR daftar",
    reviews: "Ulasan",
    reviewsHint: "Ulasan Google belum dibalas",
    outlets: "Cabang",
    stampsMonth: "Stamp bulan ini",
    stampsMonthHint: "Hanya struk yang disetujui",
    setupLoyalty: "Pasang loyalty",
    openInbox: "Inbox",
    openLoyalty: "Loyalty",
    openCustomers: "Pelanggan",
    openBrands: "Merek",
    openTraining: "Pelatihan",
    hqOn: "Terhubung",
    hqOff: "Sambung WhatsApp HQ",
    nextTitle: "Kerjakan ini dulu",
    nextSetup: "Nyalakan kartu stamp di Pengaturan → Loyalty sebelum kasir mulai.",
    nextApprove: "Setujui {n} struk supaya stamp hidup.",
    nextInbox: "Balas {n} chat yang menunggu.",
    brands: "Merek",
    inboxEmpty: "Tidak ada chat yang menunggu kamu.",
    queueEmpty: "Tidak ada struk di antrian Approve.",
    receipt: "Struk",
    emptyTitle: "Belum ada merek di meja ini",
    emptyBody: "Tambah merek, lalu pasang QR daftar, kartu stamp, dan WhatsApp HQ.",
    live: "Live",
    mapsTitle: "Listing Google",
    mapsMapped: "Terpasang di Google",
    mapsMappedHint: "Cabang dengan Business Profile aktif",
    mapsNeedLook: "Listing perlu dicek",
    mapsNeedLookHint: "Draft, parsial, atau terblokir",
    mapsReviews: "Ulasan menunggu",
    mapsNote: "Minta arah itu niat datang, bukan kunjungan. Metrik Maps lengkap ada di tiap cabang.",
    mapsOpen: "Detail cabang",
    mapsConnect: "Sambung Google",
    googleOn: "Google terhubung",
    googleOff: "Google belum terhubung",
    periodTitle: "Di rentang ini",
    liveTitle: "Sekarang",
    preset7: "7 hari",
    preset28: "28 hari",
    presetMonth: "Bulan ini",
    rangeFrom: "Dari",
    rangeTo: "Sampai",
    compare: "Bandingkan periode sebelumnya",
    vsPrior: "vs sebelumnya",
    stampsRange: "Stamp",
    stampsRangeHint: "Struk sah di rentang ini",
    newMembers: "Member baru",
    newMembersHint: "Daftar di rentang ini",
    inboundChats: "Orang yang menulis",
    inboundChatsHint: "Chat unik dengan pesan masuk",
    newReviews: "Ulasan baru",
    newReviewsHint: "Ulasan Google yang masuk — bukan kunjungan Maps",
  },
  settings: {
    eyebrow: "Workspace",
    badge: "Pusat konfigurasi",
    title: "Pengaturan",
    description:
      "Perbarui tampilan aplikasi — logo, copy merek bilingual, dan alur pertumbuhan. Perubahan berlaku di login, sidebar, dan Control Tower.",
    hubDescription:
      "Workspace di satu tempat: sambungkan Google dan aplikasi chat, branding, bahasa, dan kunci API.",
    navOverview: "Ringkasan",
    navOverviewHint: "Hub & bahasa",
    navBranding: "Branding",
    navBrandingHint: "Logo & copy produk",
    navApi: "Konfigurasi API",
    navApiHint: "Key, OAuth, mode",
    navPassword: "Password",
    navPasswordHint: "Login kamu dan tim",
    navChatApps: "Aplikasi chat",
    navChatAppsHint: "WhatsApp, Facebook, Instagram, TikTok",
    navGoogle: "Google",
    navGoogleHint: "Login Business Profile dan pasangkan cabang",
    navPages: "Halaman",
    navPagesHint: "About, Contact, FAQ, sosial",
    hubPasswordBody:
      "Ganti password kamu. Super admin juga bisa pasang password baru untuk tim atau user cabang.",
    hubBrandingBody:
      "Logo, monogram, warna utama, dan pesan bilingual di login, sidebar, dan Control Tower.",
    hubChatAppsBody:
      "Sambungkan WhatsApp HQ, WhatsApp cabang, Messenger, Instagram, dan TikTok. Pairing di sini — chat tetap di Inbox.",
    hubGoogleBody:
      "Sambungkan Google Business Profile, lalu pasangkan listing Maps ke cabang yang benar. Ulasan dan balasan pakai ini.",
    hubPagesBody:
      "Halaman About, Contact, dan FAQ. Form kontak mengirim ke hello@atlasnow.co lewat Google Workspace.",
    hubApiBody:
      "Google Business Profile, Maps, WhatsApp, Meta, TikTok, Ads, Search Console — kredensial dan mode mock/live.",
    hubApiMeta: "siap atau mock-ready",
    openSection: "Buka",
    agencyOnly: "Hanya staf agen. Pengguna klien mengelola pengalaman merek di Branding.",
    apiBadge: "Integrasi",
    apiDescription:
      "Registry pusat untuk setiap API eksternal. Simpan kredensial di sini, lalu sambungkan Google atau aplikasi chat dari Pengaturan.",
    panel: "Panel",
    scope: "Cakupan",
    storage: "Penyimpanan",
    language: "Bahasa antarmuka",
    languageHint:
      "Bahasa Inggris adalah bahasa produk default. Beralih ke Bahasa Indonesia kapan saja.",
    branding: "Branding",
    appIdentity: "Identitas aplikasi",
    appIdentityHint: "Logo dan nama di sidebar, login, dan shell.",
    messagingEn: "Pesan · English (utama)",
    messagingEnHint: "Bahasa produk kanonik. Gunakan untuk deck, PRD, dan sales.",
    messagingId: "Pesan · Bahasa Indonesia",
    messagingIdHint: "Lokalisasi opsional saat bahasa antarmuka diset ke ID.",
    appName: "Nama aplikasi",
    monogram: "Huruf monogram",
    logoImage: "Gambar logo",
    uploadLogo: "Unggah logo",
    clearLogo: "Hapus logo",
    logoHint: "PNG / JPG / WebP · maks ~600KB",
    primaryColor: "Warna utama",
    supportEmail: "Email dukungan",
    tagline: "Tagline",
    hero: "Headline hero",
    narrative: "Narasi pendukung",
    promise: "Janji produk inti",
    flow: "Alur pertumbuhan (satu langkah per baris)",
    flowHint: "Default: Optimize location assets → … → Generate measurable outcomes",
    save: "Simpan branding",
    saving: "Menyimpan…",
    reset: "Reset form",
    saved: "Branding tersimpan. UI diperbarui.",
    saveFailed: "Gagal menyimpan",
    logoNotImage: "File harus gambar (PNG, JPG, SVG, WebP).",
    logoTooLarge: "Logo maks ~600KB. Kompres dulu atau pakai monogram.",
  },
  brandStory: {
    brandPromise: "Janji merek",
    growthFlow: "Alur pertumbuhan",
  },
  clients: {
    eyebrow: "Admin agen",
    badge: "Database klien",
    title: "Klien",
    description:
      "Buat klien brand, simpan data kontak, dan aktifkan login workspace saat siap.",
    newClient: "Klien baru",
    total: "Total klien",
    loginOn: "Login aktif",
    loginOff: "Login nonaktif",
    empty: "Belum ada klien",
    emptyHint: "Tambah klien brand pertama untuk onboarding managed service.",
    colName: "Klien",
    colIndustry: "Industri",
    colContact: "Kontak",
    colLogin: "Login",
    colUsers: "Pengguna",
    colStatus: "Status",
    view: "Buka",
    agencyOnly: "Area ini hanya untuk staf agen.",
    followUp: "Perlu follow-up",
    followUpMenu: "Buka daftar follow-up",
    followUpTitle: "Menunggu aktivasi",
    followUpHint:
      "Yang daftar sendiri di situs, dan merek yang loginnya masih mati. Hubungi dulu, baru nyalakan login — mereka tidak masuk dashboard sebelum itu.",
    followUpEmpty: "Tidak ada yang menunggu",
    followUpEmptyHint: "Daftar baru dan merek dengan login mati muncul di sini.",
    selfServe: "Daftar di situs",
    turnOnLogin: "Nyalakan login",
    allBrands: "Semua merek",
  },
  conversations: {
    eyebrow: "Inbox",
    badge: "Live",
    title: "Percakapan",
    description:
      "Balas dari WhatsApp HQ, Messenger, dan Instagram. WhatsApp cabang hanya dilihat — balas dari HP toko.",
    unreplied: "belum dibalas",
    search: "Cari nama, telepon, atau teks…",
    filterAll: "Semua",
    filterUnreplied: "Belum dibalas",
    allLocations: "Semua cabang",
    colSource: "Sumber",
    filterSourceAll: "Semua sumber",
    colLast: "Terakhir",
    colContact: "Kontak",
    colPreview: "Pratinjau",
    colBranch: "Cabang",
    colDirection: "Status",
    view: "Buka",
    emptyNoMap: "Map kanal ini di Chat apps (WhatsApp HQ, Messenger, Instagram, TikTok) atau tab Sumber di outlet.",
    emptyWait: "Menunggu pesan.",
    accountResponder: "Penanggap akun",
    businessAppSource: "WhatsApp Business App",
    historySync: "Sinkron riwayat",
    handoffTakeover: "Ambil alih",
    handoffResume: "Lanjutkan otomasi",
    handoffActive: "Seseorang sedang menangani chat ini. Otomasi diam sampai dilanjutkan atau masa handoff berakhir.",
    agencyOnly: "Staf memonitor percakapan.",
    pickClient: "Pilih merek",
    pickClientHint: "Buka merek untuk melihat chat HQ dan cabang.",
    cardClients: "Klien",
    cardBranches: "Cabang",
    cardChats: "Chat",
    allClients: "Semua merek",
    filterHq: "WhatsApp HQ",
    filterBranch: "WhatsApp cabang",
    filterTiktok: "TikTok",
    dirIn: "Masuk",
    dirOut: "Dibalas",
    updated: "Diperbarui",
    replyHq: "Balas dari HQ…",
    replyIg: "Balas di Instagram…",
    replyFb: "Balas di Messenger…",
    send: "Kirim",
    branchWatch: "Ini nomor cabang. Balas dari HP toko. Atlas hanya kirim dari WhatsApp HQ.",
    colAsset: "Page / akun",
    filterSourceTitle:
      "Saring kanal. Messenger adalah Facebook Page yang terhubung. Instagram adalah akun Professional yang tertaut ke Page itu.",
    filterBranchTitle: "Saring percakapan menurut cabang tempat Page atau akun dipetakan.",
    openTitle: "Buka percakapan ini untuk membalas dari AtlasNow",
    viaWebhook: "Diterima via webhook",
    sentFromApp: "Terkirim dari AtlasNow",
    sendTitleFb: "Kirim balasan ini ke pelanggan di Messenger",
    sendTitleIg: "Kirim balasan ini ke pelanggan di Instagram",
    sendTitleHq: "Kirim balasan ini ke pelanggan di WhatsApp HQ",
    composerHintFb:
      "Kirim langsung ke Messenger. Teks yang sama harus muncul di aplikasi Messenger native.",
    composerHintIg:
      "Kirim langsung ke Instagram. Teks yang sama harus muncul di aplikasi Instagram native.",
    composerHintHq: "Kirim langsung dari WhatsApp HQ ke WhatsApp pelanggan.",
    attachFile: "Lampirkan",
    downloadFile: "Unduh",
    fileRemoved: "Berkas dihapus setelah masa simpan.",
    sentConfirmFb: "Terkirim ke Messenger. Cek teks yang sama di aplikasi Messenger native.",
    sentConfirmIg: "Terkirim ke Instagram. Cek teks yang sama di aplikasi Instagram native.",
    sentConfirmHq: "Terkirim ke WhatsApp HQ.",
    listeningWebhook: "Mendengarkan pesan baru di Page ini via webhook.",
    newViaWebhook: "Baru · webhook",
    closeThread: "Tutup percakapan",
  },
  customers: {
    eyebrow: "Demand",
    badge: "Buku orang",
    title: "Pelanggan",
    description:
      "QR daftar, chat HQ, dan chat cabang dalam satu buku. Calon jadi member hanya setelah struk pertama di-Approve dan tembus min merek. Export bukan daftar blast.",
    search: "Cari nama, telepon, atau email…",
    withPhone: "punya nomor",
    colPhone: "Phone",
    colName: "Name",
    colBranch: "Branch",
    colThreads: "Threads",
    colLast: "Last seen",
    colStatus: "Status",
    colSource: "Source",
    colActiveAt: "Active at",
    colStamps: "Stamps",
    colBirthday: "Birthday",
    colBirthdayWa: "Birthday WA",
    colEmail: "Email",
    colCity: "City",
    colProvince: "Province",
    openChats: "Chat",
    empty: "Belum ada orang.",
    emptyHint: "Cetak QR daftar di Settings → Loyalty, atau tunggu chat WhatsApp ke HQ atau cabang.",
    agencyOnly: "Staf agen mengelola buku pelanggan.",
    export: "Export CSV",
    filterAllClients: "Semua merek",
    filterAllBranches: "Semua cabang",
    colClient: "Merek",
    pickClient: "Pilih merek",
    pickClientHint: "Buka merek untuk melihat member QR daftar dan orang yang chat HQ atau cabang.",
    cardClients: "Merek",
    cardCustomers: "Orang",
    cardBranches: "Cabang",
    allClients: "Semua merek",
    peopleCount: "{n} orang",
    statusAll: "Semua status",
    statusPotential: "Potensi",
    statusProspect: "Calon",
    statusMember: "Member",
    chipPotential: "Potensi",
    chipProspect: "Calon",
    chipMember: "Member",
    countPotential: "{n} potensi",
    countProspect: "{n} calon",
    countMember: "{n} member",
    sourceJoinQr: "QR daftar",
    sourceStaff: "Staf",
    sourceHqChat: "Chat HQ",
    sourceBranchChat: "Chat cabang",
    yes: "Yes",
    no: "No",
    detailTitle: "Pelanggan",
    detailClose: "Tutup",
    detailJoined: "Daftar",
    detailActivated: "Jadi member di",
    detailChats: "WhatsApp",
    detailNoChat: "Belum chat HQ atau cabang.",
    detailExplainPotential:
      "Pernah chat HQ atau cabang. Belum member sampai isi QR daftar.",
    detailExplainProspect:
      "Sudah isi QR daftar. Membership mulai setelah struk pertama di-Approve dan tembus min merek.",
    detailExplainMember:
      "Struk sah pertama sudah di-Approve. Kartu stamp dan hadiah ultah bisa berlaku.",
    detailOpen: "Buka profil",
    hq: "HQ",
    branch: "Cabang",
  },
  reports: {
    eyebrow: "Laporan",
    badge: "Loyalty · bulan ini",
    title: "Loyalty bulan ini",
    description:
      "Angka dari struk yang di-Approve, stamp, dan hadiah yang kasir Redeem. Bukan kunjungan, bukan scan, bukan Cirqle.",
    pickBrand: "Pilih merek. Setiap merek punya kartu stamp, top spender, dan program ultah sendiri.",
    noBrands: "Belum ada merek. Tambah di Brands.",
    openMonth: "Buka loyalty bulan ini",
    tabLoyalty: "Loyalty",
    tabOutlets: "Cabang",
    outletsTitle: "Listing Google per cabang",
    outletsHint:
      "Kesehatan listing tingkat tinggi. Buka cabang untuk impression Maps, telepon, dan minta arah — tidak dihitung sebagai kunjungan.",
    colCity: "Kota",
    colMapped: "Google",
    colReviews: "Ulasan",
    colUnreplied: "Menunggu balasan",
    colReady: "Profil",
    mappedYes: "Terpasang",
    mappedNo: "Belum",
    openOutlet: "Buka",
    outletsEmpty: "Belum ada cabang.",
    allBrands: "Semua merek",
    toLoyalty: "Meja loyalty",
    toSettings: "Aturan program",
    heroKicker: "Program loyalty kamu bulan ini",
    withAtlasNow: "Bulanmu bersama AtlasNow",
    membersReturned: "Member kembali",
    membersReturnedHint: "Orang yang punya struk sah bulan ini, dan sudah pernah belanja sebelumnya. Yang baru ada di Aktif baru.",
    stampsThisMonth: "Stamp bulan ini",
    stampsHint: "1 struk sah yang tembus min merek = 1 stamp. Bukan penghitung kunjungan.",
    receiptsThisMonth: "Struk bulan ini",
    receiptsHint: "Struk yang di-Approve bulan ini. Kartu stamp mati — angka ini tetap masuk top spender.",
    rewardsRedeemed: "Hadiah ditebus",
    redeemHint: "Hadiah yang kasir tekan Redeem. Bukan janji di chat.",
    kindStamp: "stamp",
    kindSpender: "top spender",
    kindBirthday: "ultah",
    topRegular: "Paling rajin",
    topRegularHint: "Stamp terbanyak bulan ini.",
    topSpender: "Top spender",
    topSpenderHint: "Belanja sah terbesar bulan ini.",
    topEmpty: "Belum ada struk sah bulan ini.",
    joined: "Daftar",
    joinedHint: "Isi QR membership bulan ini. Masih calon sampai ada struk sah.",
    activated: "Aktif baru",
    activatedHint: "Struk sah pertama bulan ini. Di situlah membership jadi aktif.",
    shoppers: "Belanja",
    shoppersHint: "Member unik yang punya minimal satu struk sah bulan ini.",
    chipMembership: "Membership",
    chipMembershipDetail: "QR daftar · aktif setelah struk pertama",
    chipStamp: "Kartu stamp",
    chipSpender: "Top spender",
    chipSpenderDetail: "Top {n} bulan ini",
    chipBirthday: "Ultah",
    chipBirthdayDetail: "Sekali setahun di kasir — wajib kode WhatsApp",
    birthdayTitle: "Tebus ultah",
    birthdayHint: "Kasir mengetik kode dari WhatsApp. Satu per member per tahun.",
    birthdayEmpty: "Belum ada kode ultah ditebus bulan ini.",
    colWhen: "Waktu",
    colCode: "Kode",
    colValue: "Nilai",
    stampRankTitle: "Ranking stamp bulan ini",
    stampRankHint: "Stamp sah terbanyak bulan ini. Bukan sisa kartu seumur hidup.",
    stampRankEmpty: "Belum ada stamp bulan ini.",
    colStamps: "Stamp",
    spenderTitle: "Top spender bulan ini",
    spenderHint: "Belanja sah di struk Approve. Juara 1 hanya dapat hadiah juara 1. Tabel 20 besar.",
    spenderEmpty: "Belum ada belanja sah bulan ini.",
    outletTitle: "Per cabang",
    outletHint: "Stamp atau struk yang tercatat di tiap cabang bulan ini.",
    outletEmpty: "Belum ada struk Approve bulan ini.",
    colRank: "Peringkat",
    colMember: "Member",
    colSpend: "Belanja",
    colReward: "Hadiah",
    colOutlet: "Cabang",
    cardV1Title: "Member tunjuk kartu stamp di mana (v1)",
    cardV1Body:
      "Chat ke nomor WhatsApp HQ: Status Stamp / Cek Stamp. Atlas membalas kartu yang hidup. Kasir juga bisa ketik nomor HP di Loyalty → Cek member. QR stamp di HP belakangan.",
    cardV1Cost:
      "Pelanggan yang chat dulu, jadi balasan masuk jendela layanan 24 jam — bukan template marketing. Sambungkan nomor resmi HQ di Chat apps.",
  },
  broadcast: {
    eyebrow: "WhatsApp HQ",
    title: "Broadcast",
    description:
      "Pilih pesannya, pilih orangnya, lalu kirim. Balasan service hanya ke yang chat nomor HQ dalam sehari terakhir. Template hanya ke yang bilang boleh WhatsApp saat daftar — bukan daftar nomor yang diunggah. Ucapan ultah jalan sendiri, sekali setahun.",
    brand: "Merek",
    pickBrand: "Pilih merek",
    window: "Jendela terbuka",
    windowHint: "Chat HQ 24 jam terakhir — pesan service, bukan template",
    opted: "Izin ultah",
    optedHint: "Centang WhatsApp ultah di form daftar. H-2 auto kirim birthday_greeting sekali setahun. Bisa juga kirim template sekarang.",
    hqOn: "Terhubung",
    hqOff: "Belum nyambung",
    noHq: "Sambung WhatsApp HQ resmi dulu.",
    connectHq: "Chat apps",
    wabaHowTitle: "Cara sambung WhatsApp HQ",
    wabaHowLead:
      "Broadcast, loyalty, dan inbox HQ pakai satu nomor bisnis resmi — bukan HP cabang.",
    wabaAtlasTitle: "Atlas yang sambungkan",
    wabaAtlasBody:
      "Jalur biasa. Kirim nomor HQ merek ke kami. P2P Labs daftarkan di WhatsApp Cloud dan tempel di Chat apps. Kamu tidak perlu akun developer Meta.",
    wabaSelfTitle: "Merek daftar sendiri",
    wabaSelfBody:
      "Di Meta Business Suite → WhatsApp Manager, buat WhatsApp Business Account dan tambahkan nomor HQ itu. Salin Phone number ID, WABA ID, dan token akses yang tidak kedaluwarsa (Meta menyebutnya system user token). Tempel ketiga itu di Settings → Chat apps. Webhook kami sudah https://atlasnow.co/api/webhooks/whatsapp.",
    wabaDont: "Jangan scan QR untuk HQ. Jangan pakai WhatsApp toko. Satu nomor tidak bisa Cloud API dan QR HP sekaligus.",
    wabaOpenChatApps: "Buka Chat apps",
    compose: "Pesan",
    placeholder: "Tulis catatan layanan. Ini bukan template promo.",
    send: "Kirim ke yang dipilih",
    sending: "Mengirim…",
    sendHint: "Maksimal {max} orang per kirim. Masing-masing masih harus di dalam jendela 24 jam.",
    confirm: "Saya paham ini ke orang yang sudah chat HQ, bukan daftar belian.",
    empty: "Belum ada yang chat HQ dalam 24 jam terakhir.",
    resultOk: "Terkirim {n}. Gagal {f}.",
    rulesTitle: "Aturannya",
    rule1: "Tidak ada unggah CSV. Export dari Customers itu buku, bukan daftar blast.",
    rule2: "Balasan service: hanya jendela 24 jam setelah mereka chat HQ. Jendela itu siapa yang boleh dibalas, bukan harga Meta gratis.",
    rule3: "Template: hanya yang centang WhatsApp ultah di form daftar. STOP mengeluarkan mereka. Bukan otomatis — kamu yang tekan kirim.",
    laterBody: "Template marketing ke member yang opt-in bukan tombol ini. Tombol ini catatan layanan ke orang yang sudah di chat.",
    selectAll: "Pilih jendela",
    selected: "{n} dipilih · maks {max}",
    network: "Jaringan error. Coba lagi.",
    tabSession: "Service",
    tabTemplates: "Template",
    tabPayg: "Pay as you go",
    tabHistory: "Riwayat",
    historyEmpty: "Belum ada kiriman HQ.",
    historyEmptyHint: "Status muncul setelah Meta memanggil kami — bukan saat tombol Send.",
    historyFoot: "Dibaca hanya jika pelanggan nyala read receipt. Action = balas HQ atau tap tombol template. Bukan visit, bukan klik URL.",
    historyAttempted: "Dicoba",
    historySent: "Terkirim",
    historyDelivered: "Sampai HP",
    historyRead: "Dibaca",
    historyFailed: "Gagal",
    historyAction: "Action",
    historyBirthday: "Ultah H-2",
    historyLoading: "Memuat…",
    recipients: "Penerima",
    optInList: "Izin ultah",
    sessionKind: "Service",
    marketingKind: "Marketing",
    utilityKind: "Utility",
    estimate: "Estimasi",
    metaCost: "Meta (rate card)",
    atlasFee: "Biaya AtlasNow",
    vat: "Perkiraan PPN 11%",
    total: "Total yang dikutip",
    perMessage: "per pesan",
    templatesTitle: "Template HSM",
    templatesHint:
      "Langkah 1 pilih template APPROVED. Langkah 2 centang nomor. Langkah 3 kirim. Yang belum APPROVED tidak bisa dikirim. Penerima = yang centang izin ultah di form daftar — bukan CSV, bukan nomor TikTok.",
    goDealPreset: "Isi template voucher TikTok GO",
    goDealPresetHint:
      "MARKETING. Variabel: nama, merek, voucher, gerai. Beli di TikTok, QR di kasir, chat ini bukan voucher, STOP.",
    birthdayPreset: "Isi template birthday_greeting",
    birthdayPresetHint:
      "Isi sama untuk semua merek. Atlas mengisi {{customer_name}} (form daftar), {{voucher_number}} (Loyalty → Hadiah ultah), {{code_voucher}} (unik per member/tahun). Meta tetap review di WABA ini.",
    createTemplate: "Kirim ke Meta",
    templateName: "Nama (huruf_kecil_underscore)",
    templateBody: "Isi",
    templateLang: "Bahasa",
    category: "Kategori",
    submitted: "Terkirim ke Meta",
    approved: "Disetujui",
    pending: "Menunggu review",
    rejected: "Ditolak",
    sendTemplate: "Kirim template yang disetujui",
    confirmTemplate: "Saya paham ini template berbayar ke orang yang opt-in — bukan daftar belian.",
    noTemplates: "Belum ada template di WABA ini. Isi form di bawah.",
    noOptIn: "Belum ada yang centang WhatsApp ultah di form daftar.",
    paygTitle: "Pay as you go",
    paygHint:
      "Estimasi memakai rate card IDR Meta 1 Okt 2026 (negara penerima yang menentukan tarif; Indonesia marketing Rp 586,33, utility/service Rp 356,65 di kartu itu). AtlasNow menambah biaya platform. Catatan sesi = service: 1.000 terkirim pertama per nomor bisnis per bulan gratis dari Meta, setelah itu tarif utility Meta untuk penerima itu. Layar ini perkiraan. Konfirmasi faktur di WhatsApp Manager.",
    paygMetaNote: "Angka CSV belum termasuk PPN. Kalau Meta tagih di Indonesia, PPN 11% bisa muncul di baris Meta.",
    example: "Contoh",
    attach: "Gambar atau PDF",
    attachHint: "JPEG, PNG, WebP maks 5 MB. PDF maks 16 MB. Caption boleh kosong.",
    attached: "Terlampir",
    removeFile: "Lepas",
    uploading: "Lagi diunggah ke WhatsApp…",
    headerSample: "Contoh header (gambar atau PDF)",
    headerSampleHint:
      "Kalau dilampirkan, Meta review ini sebagai header template. Pas kirim, lampirkan file aslinya lagi.",
    needsHeader: "Template ini butuh gambar atau PDF di header.",
    headerOnSend: "File header untuk kiriman ini",
    editFees: "Ubah fee / margin Atlas → Settings",
    feesLocked: "Fee Atlas cuma Super Admin yang bisa ubah.",
    stepWhat: "1 · Mau kirim apa",
    stepWho: "2 · Ke siapa",
    stepSend: "3 · Kirim",
    sessionStepWho: "1 · Ke siapa (chat HQ 24 jam terakhir)",
    sessionStepWhat: "2 · Isi pesan",
    waitingMeta: "Belum disetujui — belum bisa dikirim",
    noApproved: "Belum ada template APPROVED. Kirim dulu ke Meta di bawah, tunggu review.",
    birthdayNotAuto:
      "Centang di form daftar. H-2 auto kirim birthday_greeting sekali setahun ke member aktif. Daftar ini juga untuk kirim manual. STOP mengeluarkan mereka.",
    selectAllOpt: "Pilih semua",
    sendToN: "Kirim ke {n} nomor",
    whyNoTpl: "Pilih template yang APPROVED.",
    whyNoPeople: "Pilih minimal satu nomor.",
    whyNoHeader: "Template ini butuh gambar atau PDF header dulu.",
    whyNoConfirm: "Centang konfirmasi di bawah.",
    setupTitle: "Template baru ke Meta",
    setupHint: "Ini bukan kirim ke customer. Meta yang review. Setelah APPROVED muncul di langkah 1.",
  },
  loyaltyDesk: {
    eyebrow: "Loyalty",
    badge: "Stamp tidak butuh Cloud API",
    title: "Kasir",
    description:
      "Cek tamu, foto struk, lalu stamp. Kode ultah hanya di jendela ulang tahun, setelah mereka jadi member.",
    training: "Pelatihan",
    monthReport: "Laporan bulan ini",
    pickBrand: "Pilih merek. Tiap merek punya kartu stamp dan top spender sendiri.",
    pickBrandHint: "Buka antrian, kirim struk, tebus",
    noBrands: "Belum ada merek. Tambah di Brands.",
    openBrand: "Buka antrian, kirim struk, tebus",
    brand: "Merek",
    notMember: "Belum member",
    notMemberHint: "Kasih QR daftar (Settings → Loyalty). Isi HP + nama. Baru calon.",
    isMember: "Sudah member",
    isMemberHint: "Cek HP, atau tab Scan QR ke kartu di HP pelanggan.",
    tabQueue: "Antrian",
    tabSubmit: "Submit struk",
    tabMember: "Cek HP",
    tabScan: "Scan QR",
    colOutlet: "Cabang",
    colPhone: "HP",
    colReceipt: "No. struk",
    colRp: "Rp",
    colPhoto: "Foto",
    queueEmpty: "Tidak ada antrian. MATCH auto-stamp. Yang di sini: buram, beda, atau mode audit.",
    approve: "Approve",
    reject: "Tolak",
    hqStamps: "Kantor yang cap",
    phoneMember: "HP member",
    amount: "Nominal (Rp)",
    reading: "Membaca struk…",
    sendReceipt: "Kirim struk",
    checkPhoneTitle: "Cek HP",
    checkPhoneHint: "Nomor yang dipakai di form daftar. QR stamp ada di tab Scan QR — bukan stiker meja.",
    check: "Cek",
    scanTitle: "Scan QR stamp atau TikTok GO",
    scanHint: "QR stamp member, atau QR voucher TikTok GO (awalan TT-). Bukan stiker daftar di meja.",
    notStampCard: "bukan stamp kartu",
    redeemGo: "Tebus voucher TikTok GO",
    pasteLink: "Tempel tautan kartu",
    open: "Buka",
    fillReceipt: "Isi struk",
    photoRequiredLabel: "Foto struk (wajib)",
    changePhoto: "Ganti foto",
    takePhoto: "Ambil foto kertas",
    photoHint: "Kertas utuh, cahaya cukup. Bukan screenshot chat.",
    photoAlt: "Struk",
    match: "Cocok",
    mismatch: "Beda",
    unreadable: "Tidak kebaca",
    photoRp: "Foto Rp",
    amountRequired: "Nominal wajib. Isi Rp dari kertas kasir.",
    photoRequired: "Foto struk wajib.",
    receiptRequired: "Isi No. transaksi / No. Struk / No. Invoice.",
    receiptNos: "No. transaksi / No. Struk / No. Invoice",
    receiptNosHint: "Dari kertas kasir. Mesin beda nama — isi nomor yang tercetak.",
    stampRecorded: "Stamp tercatat. Nomor dan Rp di foto cocok.",
    matchOffice: "Foto cocok. Mode kantor cek semua — menunggu Approve.",
    mismatchQueue: "Foto dan angka kasir beda. Masuk antrian kantor.",
    unreadableQueue: "Foto tidak kebaca. Struk di antrian kantor. Belum stamp.",
    memberFound: "Member ketemu. Isi nomor struk di bawah. Belum stamp sampai Approve.",
    goFailed: "QR TikTok GO gagal",
    qrFailed: "QR gagal",
    redeemGoOk: "Voucher TikTok GO tebus di {name}. Bukan stamp.",
    outlet: "Cabang",
    giftInSettings: "Hadiah di setting merek",
    lifeProspect: "Calon",
    lifeMember: "Aktif",
    lifeNone: "Belum daftar",
    nextProspect: "Kirim struk. Tiket pertama yang di-Approve membuat mereka member — baru stamp dan ultah.",
    birthdayTitle: "Ultah",
    birthdayOff: "Hadiah ultah mati di Settings → Loyalty.",
    birthdayWaitMember: "Ultah setelah struk pertama di-Approve.",
    birthdayWaitWindow: "Di luar jendela ultah (H-2 sampai 7 hari sesudah).",
    birthdayNeedWa: "WhatsApp belum kirim kodenya.",
    birthdayReady: "Tamu tunjukkan chat. Ketik kode itu — jangan mengarang.",
    birthdayRedeemed: "Sudah ditebus tahun ini.",
    birthdayCodePh: "BDY26-XXXX",
    redeemBirthday: "Tebus ultah",
    noOutlet: "Belum ada gerai. Tambah di Outlets sebelum kirim struk.",
    noOutletLink: "Buka Outlets",
    stampTitle: "Kartu stamp",
    checkEmpty: "Cek HP dulu. Nanti muncul member, stamp, ultah, dan form struk.",
    waBirthdayYes: "WhatsApp ultah: ya",
    goSample: "QR contoh — tidak nembak TikTok. QR TT- sungguhan butuh Chat apps → TikTok GO till.",
    goRecap: "Tebus TikTok GO (merek ini)",
    goRecapEmpty: "Belum ada tebus. Coba QR contoh, lalu Tebus.",
    goConnect: "Konek TikTok GO",
    goPublicDemo: "Demo publik",
    goChipOk: "QR valid",
    goChipWrong: "Salah cabang",
    goChipUsed: "Sudah dipakai",
    goChipTime: "Di luar jam",
  },
};

const catalogs: Record<Locale, Messages> = { en, id };

export function getMessages(locale: Locale): Messages {
  return catalogs[locale] ?? catalogs.en;
}
