import * as yup from "yup";
import { Timestamp } from "firebase/firestore";
import type {
  Student,
} from "@/lib/firestore";

export const CURRENT_CONSENT_VERSION = "2025-09";

export function onlyDigits(v: string) {
  return String(v || "").replace(/\D/g, "");
}

export function isMinor(iso?: string) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  const birth = new Date(y || 0, (m || 1) - 1, d || 1);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age < 18;
}

function formatCpfDigits(digits: string) {
  const clean = onlyDigits(digits).slice(0, 11);
  if (clean.length !== 11) return clean;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
}

function formatPhoneDigits(digits: string) {
  const clean = onlyDigits(digits).slice(-11) || "";
  if (!clean) return "";
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  return clean;
}

function formatCepDigits(digits: string) {
  const clean = onlyDigits(digits).slice(0, 8);
  if (clean.length !== 8) return clean;
  return `${clean.slice(0, 5)}-${clean.slice(5)}`;
}

export const studentFormSchema = yup.object({
  name: yup.string().trim().min(2, "Nome muito curto").required("Nome obrigatorio"),
  birthDate: yup.string().required("Data de nascimento obrigatoria"),
  whatsapp: yup
    .string()
    .optional()
    .test("wpp", "Whatsapp invalido", function (value) {
      const digits = onlyDigits(String(value || ""));
      const bd = (this.parent as { birthDate?: string }).birthDate;
      const isMinorStudent = isMinor(bd);
      const validLength = digits.length === 10 || digits.length === 11;
      if (isMinorStudent) {
        return !value || validLength;
      }
      return !!value && validLength;
    }),
  email: yup
    .string()
    .transform((v) => {
      const s = String(v || "").trim().toLowerCase();
      return s === "" ? undefined : s;
    })
    .email("Email invalido")
    .test("email-req", "Email obrigatorio", function (value) {
      const bd = (this.parent as { birthDate?: string }).birthDate;
      return isMinor(bd) ? true : !!value;
    }),
  password: yup
    .string()
    .transform((v) => {
      const s = String(v || "").trim();
      return s === "" ? undefined : s;
    })
    .optional(),
  confirmPassword: yup
    .string()
    .transform((v) => {
      const s = String(v || "").trim();
      return s === "" ? undefined : s;
    })
    .test("pwd-match", "Senhas nao conferem", function (value) {
      const pwd = (this.parent as any).password;
      if (!pwd && !value) return true;
      return value === pwd;
    })
    .optional(),

  guardianName: yup
    .string()
    .test("guardian-name", "Nome do responsavel obrigatorio", function (value) {
      const bd = (this.parent as { birthDate?: string }).birthDate;
      return isMinor(bd) ? !!String(value || "").trim() : true;
    }),
  guardianPhone: yup
    .string()
    .test("guardian-phone", "Whatsapp do responsavel invalido/obrigatorio", function (value) {
      const bd = (this.parent as { birthDate?: string }).birthDate;
      const digits = onlyDigits(String(value || ""));
      const validLength = digits.length === 10 || digits.length === 11;
      return isMinor(bd) ? (!!value && validLength) : (!value || validLength);
    }),
  guardianEmail: yup
    .string()
    .transform((v) => {
      const s = String(v || "").trim().toLowerCase();
      return s === "" ? undefined : s;
    })
    .email("Email do responsavel invalido"),
  active: yup.boolean().default(true),
  activePlanId: yup.string().required("Plano obrigatorio"),
  weightKg: yup.string().optional(),
  heightCm: yup.string().optional(),
  techNotes: yup.string().optional(),
  activities: yup.object({
    funcional: yup.boolean().default(false),
    boxe: yup.boolean().default(false),
    mma: yup.boolean().default(false),
    jiuJitsu: yup.boolean().default(false),
  }).optional(),
  jiuJitsuBelt: yup.string().optional(),
  jiuJitsuDegree: yup.string().optional().test('jj-degree-rule', 'Grau invalido para a faixa selecionada', function (value) {
    const p = this.parent as any;
    const jiu = p?.activities?.jiuJitsu;
    if (!jiu) return true;
    const belt = String(p?.jiuJitsuBelt || '');
    const n = Number(String(value || '0').trim() || '0');
    if (!Number.isFinite(n)) return false;
    if (n < 0 || n > 10) return false;
    const isBlackOrRed = belt === 'preta' || belt === 'vermelha';
    if (!isBlackOrRed && n > 4) return false;
    return true;
  }),
  billingDocument: yup
    .string()
    .required("Documento obrigatorio")
    .test("cpf", "CPF invalido", (value) => onlyDigits(String(value || "")).length === 11),
  billingName: yup.string().trim().min(3, "Nome muito curto").required("Nome do pagador obrigatorio"),
  billingEmail: yup
    .string()
    .trim()
    .lowercase()
    .email("Email do pagador invalido")
    .required("Email do pagador obrigatorio"),
  billingPhone: yup
    .string()
    .required("Telefone obrigatorio")
    .test("phone", "Telefone invalido", (value) => {
      const digits = onlyDigits(String(value || ""));
      return digits.length === 10 || digits.length === 11;
    }),
  billingZipCode: yup
    .string()
    .required("CEP obrigatorio")
    .test("zip", "CEP invalido", (value) => onlyDigits(String(value || "")).length === 8),
  billingStreet: yup.string().trim().min(2, "Rua obrigatoria").required("Rua obrigatoria"),
  billingNumber: yup.string().trim().min(1, "Numero obrigatorio").required("Numero obrigatorio"),
  billingComplement: yup.string().optional(),
  billingDistrict: yup.string().trim().min(2, "Bairro obrigatorio").required("Bairro obrigatorio"),
  billingCity: yup.string().trim().min(2, "Cidade obrigatoria").required("Cidade obrigatoria"),
  billingState: yup
    .string()
    .trim()
    .uppercase()
    .matches(/^[A-Z]{2}$/, "UF invalida")
    .required("UF obrigatoria"),
  billingCountry: yup
    .string()
    .trim()
    .uppercase()
    .min(2, "Pais obrigatorio")
    .required("Pais obrigatorio"),
  billingDay: yup.number().optional(),
  subscriptionDiscount: yup.number().optional().min(0, "Desconto não pode ser negativo").max(100, "Desconto não pode ser maior que 100%"),
});

export type StudentFormData = yup.InferType<typeof studentFormSchema>;

export const emptyStudentFormValues: StudentFormData = {
  name: "",
  birthDate: "",
  whatsapp: "",
  email: "",
  guardianName: "",
  guardianPhone: "",
  guardianEmail: "",
  password: "",
  confirmPassword: "",

  active: true,
  activePlanId: "",
  weightKg: "",
  heightCm: "",
  techNotes: "",
  activities: {
    funcional: false,
    boxe: false,
    mma: false,
    jiuJitsu: false,
  },
  jiuJitsuBelt: "",
  jiuJitsuDegree: "",
  billingDocument: "",
  billingName: "",
  billingEmail: "",
  billingPhone: "",
  billingZipCode: "",
  billingStreet: "",
  billingNumber: "",
  billingComplement: "",
  billingDistrict: "",
  billingCity: "",
  billingState: "",
  billingCountry: "BR",
  billingDay: undefined,
  subscriptionDiscount: undefined,
};

type BuildDefaultsResult = {
  values: StudentFormData;
  consentMatches: boolean;
  consentDate: Date | null;
  consentVersion: string | null;
};


function inferPhoneDigits(billingContact: any) {
  if (!billingContact) return "";
  const current = onlyDigits(String(billingContact.phone ?? ""));
  if (current) return current;
  const country = onlyDigits(String(billingContact.phoneCountryCode ?? ""));
  const area = onlyDigits(String(billingContact.phoneAreaCode ?? ""));
  const number = onlyDigits(String(billingContact.phoneNumber ?? ""));
  let mix = `${area}${number}`;
  if (!mix && country && billingContact.phoneNumber) {
    mix = onlyDigits(String(billingContact.phoneNumber));
  }
  if (country === "55" && mix.length > 11) {
    mix = mix.slice(-11);
  }
  return mix;
}

export function buildStudentFormValues(student?: Partial<Student> | null): BuildDefaultsResult {
  const values: StudentFormData = { ...emptyStudentFormValues };

  if (!student) {
    return { values, consentMatches: false, consentDate: null, consentVersion: null };
  }

  values.name = student.name ? String(student.name) : "";
  const birthDate = student.birthDate ? String(student.birthDate) : "";
  values.birthDate = birthDate;

  const email = student.email ? String(student.email).trim().toLowerCase() : "";
  values.email = email;

  const whatsapp = student.whatsapp
    ? String(student.whatsapp)
    : student.phone
      ? String(student.phone)
      : "";
  values.whatsapp = whatsapp;

  values.guardianName = student.guardianName ? String(student.guardianName) : "";
  values.guardianPhone = student.guardianPhone ? String(student.guardianPhone) : "";
  values.guardianEmail = student.guardianEmail ? String(student.guardianEmail).trim().toLowerCase() : "";
  values.active = student.active !== undefined ? !!student.active : true;
  values.activePlanId = student.activePlanId ? String(student.activePlanId) : "";
  values.weightKg = student.weightKg !== undefined && student.weightKg !== null ? String(student.weightKg) : "";
  values.heightCm = student.heightCm !== undefined && student.heightCm !== null ? String(student.heightCm) : "";
  values.techNotes = student.techNotes ? String(student.techNotes) : "";

  values.password = student.password ? String(student.password) : "";
  values.confirmPassword = values.password;

  if (student.activities) {
    values.activities = {
      funcional: Boolean(student.activities.funcional),
      boxe: Boolean(student.activities.boxe),
      mma: Boolean(student.activities.mma),
      jiuJitsu: Boolean(student.activities.jiuJitsu),
    };
  }

  values.jiuJitsuBelt = student.jiuJitsuBelt ? String(student.jiuJitsuBelt) : "";
  values.jiuJitsuDegree = (student.jiuJitsuDegree !== undefined && student.jiuJitsuDegree !== null)
    ? String(student.jiuJitsuDegree)
    : "";

  const billingContact = student.billingContact as any;
  const billingAddress = student.billingAddress as any;

  values.billingDocument = billingContact?.document ? formatCpfDigits(String(billingContact.document)) : "";

  const contactName = billingContact?.name ? String(billingContact.name) : "";
  values.billingName = contactName || values.name;

  const contactEmail = billingContact?.email ? String(billingContact.email).trim().toLowerCase() : "";
  values.billingEmail = contactEmail || email;

  const phoneDigits = inferPhoneDigits(billingContact);
  values.billingPhone = phoneDigits ? formatPhoneDigits(phoneDigits) : "";

  values.billingZipCode = billingAddress?.zipCode ? formatCepDigits(String(billingAddress.zipCode)) : "";
  values.billingStreet = billingAddress?.street ? String(billingAddress.street) : "";
  values.billingNumber = billingAddress?.number ? String(billingAddress.number) : "";
  values.billingComplement = billingAddress?.complement ? String(billingAddress.complement) : "";
  values.billingDistrict = billingAddress?.district ? String(billingAddress.district) : "";
  values.billingCity = billingAddress?.city ? String(billingAddress.city) : "";
  values.billingState = billingAddress?.state ? String(billingAddress.state).toUpperCase() : "";
  values.billingCountry = billingAddress?.country ? String(billingAddress.country).toUpperCase() : "BR";

  const rawBillingDay = Number((student as any).billingDay);
  values.billingDay = rawBillingDay >= 1 && rawBillingDay <= 28 ? rawBillingDay : undefined;

  const rawDiscount = Number((student as any).subscriptionDiscount);
  values.subscriptionDiscount = rawDiscount > 0 && rawDiscount <= 100 ? rawDiscount : undefined;

  const consentTs = student.billingConsentAcceptedAt;
  let consentDate: Date | null = null;
  if (consentTs instanceof Timestamp) {
    consentDate = consentTs.toDate();
  }
  const consentVersion = student.billingConsentVersion ?? null;
  const consentMatches = !!consentDate && consentVersion === CURRENT_CONSENT_VERSION;

  return { values, consentMatches, consentDate, consentVersion };
}