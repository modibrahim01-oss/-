export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ar";

/**
 * اسم كوكي اللغة. يعيش هنا لا في locale.ts لأن مبدّل اللغة مكوّن عميل،
 * و locale.ts يستورد next/headers الذي لا يعمل في المتصفح.
 */
export const LOCALE_COOKIE = "sabbaq-locale";

export function isLocale(value: unknown): value is Locale {
  return value === "ar" || value === "en";
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

const dict = {
  ar: {
    appName: "سبّاق",
    appTagline: "نظام تحفيز الطلاب",

    // الصفحة العامة
    findYourFarm: "ابحث عن مزرعتك",
    publicIntro: "اختر المجموعة، ثم ابحث عن اسمك — واستعرض نموّ مزرعتك عبر الفصل.",
    allGroups: "كل المجموعات",
    searchByName: "ابحث بالاسم…",
    search: "بحث",
    groups: "المجموعات",
    students: "طالب",
    everyPointPlants: "كل نقطة تُغرَس نبتةً في مزرعتك",
    leaders: "المتصدّرون",
    leadersHint: "أعلى النقاط في هذا الفصل",
    noLeadersYet: "لم تُمنَح نقاط بعد — أول نقطة تفتح لوحة الصدارة",
    groupRace: "سباق المجموعات",
    leadingGroup: "في الصدارة",
    noResults: "لا توجد نتائج مطابقة",
    startTyping: "اكتب حرفين على الأقل للبحث",
    viewFarm: "اعرض المزرعة",

    // المزرعة
    totalPoints: "مجموع النقاط",
    plants: "النبتات",
    plant: "نبتة",
    points: "نقطة",
    legend: "دليل النبتات",
    dragToPan: "اسحب للتحرّك · عجلة الفأرة للتكبير",
    dragToPanTouch: "اسحب للتحرّك · قرّب بإصبعين للتكبير",
    emptyFarm: "لم تُغرَس أي نبتة بعد",
    emptyFarmHint: "أول نقطة يمنحها المشرف ستُغرَس في بستان فئتها.",
    rankInGroup: "الترتيب في المجموعة",
    backToSearch: "رجوع للبحث",

    // الدخول
    login: "تسجيل الدخول",
    logout: "تسجيل الخروج",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    loginTitle: "دخول المشرفين والإدارة",
    loginHint: "الطلاب والزوار لا يحتاجون حسابًا — أعرض المزارع من الصفحة الرئيسية.",
    loginFailed: "بيانات الدخول غير صحيحة",
    loginUnavailable: "تعذّر الوصول إلى الخادم — راجع إعدادات الاتصال ثم أعد المحاولة",

    // المشرف
    supervisorPanel: "لوحة المشرف",
    yourDailyLimit: "حدّك اليومي",
    noLimit: "بلا حد",
    of: "من",
    remaining: "المتبقّي",
    limitReached: "وصلت حدّك اليومي — تعود الأزرار للعمل غدًا",
    awardPoints: "امنح نقاط",
    selectStudentFirst: "اختر طالبًا أولًا",
    pickStudent: "اختر الطالب",
    noManualEntry: "لا يوجد إدخال يدوي — الأزرار الثابتة فقط",
    recentToday: "آخر إضافات اليوم",
    noAwardsToday: "لم تمنح أي نقاط اليوم بعد",
    awarded: "تمّ منح",
    awardFailed: "لم تُسجَّل النقاط",
    myGroups: "مجموعاتي",
    allGroupsScope: "جميع المجموعات",

    // المدير
    adminDashboard: "لوحة الإدارة",
    overview: "نظرة عامة",
    manageStudents: "الطلاب",
    manageSupervisors: "المشرفون",
    dailyLimits: "الحدود اليومية",
    semesters: "الفصول",
    reports: "التقارير",
    activeStudents: "الطلاب النشطون",
    pointsToday: "نقاط اليوم",
    activeSupervisors: "المشرفون النشطون",
    topGroup: "أعلى مجموعة",
    day: "اليوم",
    addStudent: "إضافة طالب",
    importExcel: "استيراد من Excel",
    name: "الاسم",
    group: "المجموعة",
    grade: "الصف",
    role: "الدور",
    actions: "إجراءات",
    edit: "تعديل",
    remove: "حذف",
    save: "حفظ",
    cancel: "إلغاء",
    saved: "تم الحفظ",
    pointsPerDay: "نقطة / يوم",
    topStudents: "أفضل الطلاب",
    archiveSemester: "أرشفة الفصل",
    resetFarms: "تصفير المزارع",
    archiveAndReset: "أرشفة ثم تصفير",
    semesterActions: "إجراءات نهاية الفصل",
    archiveHint: "الأرشفة تحفظ لقطة كاملة لكل الطلاب ونقاطهم قبل أي تصفير.",
    resetHint: "التصفير يُرجع كل المزارع للصفر ويبدأ فصلًا جديدًا. سجل النقاط القديم يبقى محفوظًا.",
    confirmDestructive: "هذا الإجراء يؤثر على جميع الطلاب. اكتب «تأكيد» للمتابعة.",
    confirmWord: "تأكيد",

    // الأدوار
    roleAdmin: "إدارة البرنامج",
    roleGroupSupervisor: "مشرف مجموعة",
    roleCommitteeSupervisor: "مشرف لجنة",

    // وضع الشاشات
    tvMode: "وضع العرض",
    inGroup: "في المجموعة",

    // عام
    loading: "جارٍ التحميل…",
    error: "حدث خطأ",
    retry: "إعادة المحاولة",
    language: "اللغة",
    theme: "المظهر",
  },
  en: {
    appName: "Sabbaq",
    appTagline: "Student engagement system",

    findYourFarm: "Find Your Farm",
    publicIntro: "Pick your group, search your name — watch your farm grow through the semester.",
    allGroups: "All groups",
    searchByName: "Search by name…",
    search: "Search",
    groups: "Groups",
    students: "students",
    everyPointPlants: "Every point plants something in your farm",
    leaders: "Leaders",
    leadersHint: "Highest points this semester",
    noLeadersYet: "No points yet — the first award opens the leaderboard",
    groupRace: "Group race",
    leadingGroup: "Leading",
    noResults: "No matching students",
    startTyping: "Type at least two characters",
    viewFarm: "View farm",

    totalPoints: "Total points",
    plants: "Plants",
    plant: "plant",
    points: "pts",
    legend: "Plant legend",
    dragToPan: "Drag to pan · scroll to zoom",
    dragToPanTouch: "Drag to pan · pinch to zoom",
    emptyFarm: "No plants yet",
    emptyFarmHint: "The first point a supervisor awards will be planted in its tier's grove.",
    rankInGroup: "Rank in group",
    backToSearch: "Back to search",

    login: "Sign in",
    logout: "Sign out",
    email: "Email",
    password: "Password",
    loginTitle: "Staff sign-in",
    loginHint: "Students and visitors need no account — browse farms from the home page.",
    loginFailed: "Incorrect email or password",
    loginUnavailable: "Could not reach the server — check the connection settings and try again",

    supervisorPanel: "Supervisor",
    yourDailyLimit: "Your daily limit",
    noLimit: "No limit",
    of: "of",
    remaining: "Remaining",
    limitReached: "Daily limit reached — buttons unlock tomorrow",
    awardPoints: "Award points",
    selectStudentFirst: "Select a student first",
    pickStudent: "Pick a student",
    noManualEntry: "No manual entry — fixed buttons only",
    recentToday: "Today's awards",
    noAwardsToday: "No points awarded yet today",
    awarded: "Awarded",
    awardFailed: "Points were not recorded",
    myGroups: "My groups",
    allGroupsScope: "All groups",

    adminDashboard: "Admin",
    overview: "Overview",
    manageStudents: "Students",
    manageSupervisors: "Supervisors",
    dailyLimits: "Daily limits",
    semesters: "Semesters",
    reports: "Reports",
    activeStudents: "Active students",
    pointsToday: "Points today",
    activeSupervisors: "Active supervisors",
    topGroup: "Top group",
    day: "Day",
    addStudent: "Add student",
    importExcel: "Import from Excel",
    name: "Name",
    group: "Group",
    grade: "Grade",
    role: "Role",
    actions: "Actions",
    edit: "Edit",
    remove: "Remove",
    save: "Save",
    cancel: "Cancel",
    saved: "Saved",
    pointsPerDay: "pts / day",
    topStudents: "Top students",
    archiveSemester: "Archive semester",
    resetFarms: "Reset farms",
    archiveAndReset: "Archive then reset",
    semesterActions: "End-of-semester actions",
    archiveHint: "Archiving saves a full snapshot of every student and their points before any reset.",
    resetHint: "Resetting returns every farm to zero and starts a new semester. The old ledger is kept.",
    confirmDestructive: "This affects every student. Type “CONFIRM” to proceed.",
    confirmWord: "CONFIRM",

    roleAdmin: "Program admin",
    roleGroupSupervisor: "Group supervisor",
    roleCommitteeSupervisor: "Committee supervisor",

    tvMode: "Display mode",
    inGroup: "in group",

    loading: "Loading…",
    error: "Something went wrong",
    retry: "Try again",
    language: "Language",
    theme: "Theme",
  },
} as const;

export type TranslationKey = keyof (typeof dict)["ar"];

export function t(locale: Locale, key: TranslationKey): string {
  return dict[locale][key];
}

/** مُترجِم مربوط بلغة واحدة — أقصر في الاستخدام داخل مكوّن. */
export function translator(locale: Locale) {
  return (key: TranslationKey) => dict[locale][key];
}

const ROLE_KEYS = {
  admin: "roleAdmin",
  group_supervisor: "roleGroupSupervisor",
  committee_supervisor: "roleCommitteeSupervisor",
} as const;

export function roleLabel(locale: Locale, role: keyof typeof ROLE_KEYS): string {
  return dict[locale][ROLE_KEYS[role]];
}

/** أرقام عربية-هندية للعربية، لاتينية للإنجليزية. */
export function formatNumber(locale: Locale, n: number): string {
  return n.toLocaleString(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");
}

/**
 * أرقام نصّ حرّ بخطّ اللغة: «الصف 5» تصير «الصف ٥» في الواجهة العربية.
 *
 * حقول مثل الصف تُكتب بأي أرقام يختارها المدخِل، وخلطها بجانب أرقام مُنسَّقة
 * كان يُظهر «قبس · 5» بجانب «٦٧٠».
 */
export function localizeDigits(locale: Locale, text: string): string {
  if (locale !== "ar") return text;
  return text.replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)));
}
