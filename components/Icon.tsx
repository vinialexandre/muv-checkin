import { ChevronLeft, Check, FileWarning, ChevronRight, FolderOpen, Monitor, User, Users, LogOut, LogIn, Settings, Edit, Trash2, Plus, Search, Filter, X, CalendarDays, Camera, Clock } from 'lucide-react';
import { ComponentProps } from 'react';

export type IconName =
  | 'users' | 'folder' | 'monitor' | 'user'
  | 'chevronLeft' | 'chevronRight'
  | 'logOut' | 'logIn' | 'settings'
  | 'edit' | 'trash' | 'plus'
  | 'search' | 'filter' | 'x' | 'calendar' | 'clock'
  | 'camera'
  | 'checkIcon' | 'warningIcon';

const MAP: Record<IconName, React.ComponentType<ComponentProps<'svg'>>> = {
  users: Users,
  folder: FolderOpen,
  monitor: Monitor,
  user: User,
  checkIcon: Check,
  warningIcon: FileWarning,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  logOut: LogOut,
  logIn: LogIn,
  settings: Settings,
  edit: Edit,
  trash: Trash2,
  plus: Plus,
  search: Search,
  filter: Filter,
  x: X,
  calendar: CalendarDays,
  clock: Clock,
  camera: Camera,
};

export function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 1.75, ...props }: { name: IconName } & ComponentProps<'svg'> & { size?: number; color?: string; strokeWidth?: number }) {
  const Cmp = MAP[name];
  return <Cmp width={size} height={size} color={color} strokeWidth={strokeWidth} {...props} />;
}


export { Check as checkIcon, FileWarning as warningIcon };
