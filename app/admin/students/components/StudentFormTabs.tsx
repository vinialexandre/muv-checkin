"use client";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@chakra-ui/react';
import { Control, UseFormWatch } from 'react-hook-form';
import { StudentFormData } from '@/app/admin/students/formConfig';
import GeneralDataTab from './tabs/GeneralDataTab';
import SubscriptionTab from './tabs/SubscriptionTab';
import BillingTab from './tabs/BillingTab';
import TechnicalSheetTab from './tabs/TechnicalSheetTab';
import BiometryTab from './tabs/BiometryTab';

type Plan = { id: string; name: string; price?: number; paymentMethods?: Array<'pix' | 'boleto' | 'credit_card'>; };

interface StudentFormTabsProps {
  mode: 'new' | 'edit';
  studentId?: string;
  control: Control<StudentFormData>;
  watch: UseFormWatch<StudentFormData>;
  plans: Plan[];
  currencyFormatter: Intl.NumberFormat;
  showPwd: boolean;
  setShowPwd: (v: boolean) => void;
  showPwd2: boolean;
  setShowPwd2: (v: boolean) => void;
  video: HTMLVideoElement | null;
  setVideo: (v: HTMLVideoElement | null) => void;
  faceReady: boolean;
  faceErr: string | null;
  livenessOk: boolean;
  samples: number[][];
  photoPreviews: string[];
  capturing: boolean;
  captureSample: () => void;
  openConfirm: (idx: number) => void;
  tabIndex: number;
  setTabIndex: (idx: number) => void;
  stopVideo: () => void;
  loadingCep: boolean;
}

const isMinor = (birthDate: string) => {
  if (!birthDate) return false;
  const birth = new Date(birthDate);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    return age - 1 < 18;
  }
  return age < 18;
};

export default function StudentFormTabs(props: StudentFormTabsProps) {
  const {
    mode,
    studentId,
    control,
    watch,
    plans,
    currencyFormatter,
    showPwd,
    setShowPwd,
    showPwd2,
    setShowPwd2,
    video,
    setVideo,
    faceReady,
    faceErr,
    livenessOk,
    samples,
    photoPreviews,
    capturing,
    captureSample,
    openConfirm,
    tabIndex,
    setTabIndex,
    stopVideo,
    loadingCep
  } = props;

  const birthDateValue = watch('birthDate');
  const studentNameValue = watch('name');
  const isMinorNow = isMinor(birthDateValue);
  const FACE_TAB_INDEX = 3;

  return (
    <Tabs
      variant="enclosed"
      isLazy
      lazyBehavior="unmount"
      index={tabIndex}
      onChange={(index) => {
        if (tabIndex === FACE_TAB_INDEX && index !== FACE_TAB_INDEX) {
          stopVideo();
        }
        setTabIndex(index);
      }}
    >
      <TabList>
        <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Dados gerais</Tab>
        <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Cobrança</Tab>
        <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Ficha técnica</Tab>
        <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Biometria facial</Tab>
        <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Assinatura/Plano</Tab>
      </TabList>

      <TabPanels>
        <TabPanel>
          <GeneralDataTab
            mode={mode}
            control={control}
            isMinorNow={isMinorNow}
            showPwd={showPwd}
            setShowPwd={setShowPwd}
            showPwd2={showPwd2}
            setShowPwd2={setShowPwd2}
          />
        </TabPanel>

        <TabPanel>
          <BillingTab control={control} loadingCep={loadingCep} />
        </TabPanel>

        <TabPanel>
          <TechnicalSheetTab control={control} watch={watch} />
        </TabPanel>

        <TabPanel>
          <BiometryTab
            video={video}
            setVideo={setVideo}
            faceReady={faceReady}
            faceErr={faceErr}
            livenessOk={livenessOk}
            samples={samples}
            photoPreviews={photoPreviews}
            capturing={capturing}
            captureSample={captureSample}
            openConfirm={openConfirm}
          />
        </TabPanel>

        <TabPanel>
          <SubscriptionTab
            mode={mode}
            studentId={studentId}
            control={control}
            watch={watch}
            plans={plans}
            currencyFormatter={currencyFormatter}
            studentNameValue={studentNameValue}
          />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}
