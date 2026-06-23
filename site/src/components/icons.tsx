import type { ComponentType, SVGProps } from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import CommandLineIcon from '@hugeicons/core-free-icons/CommandLineIcon';
import ComputerProgramming01Icon from '@hugeicons/core-free-icons/ComputerProgramming01Icon';
import Database02Icon from '@hugeicons/core-free-icons/Database02Icon';
import HugeGithubIcon from '@hugeicons/core-free-icons/GithubIcon';
import LayoutGridIcon from '@hugeicons/core-free-icons/LayoutGridIcon';
import LockKeyIcon from '@hugeicons/core-free-icons/LockKeyIcon';
import Menu01Icon from '@hugeicons/core-free-icons/Menu01Icon';
import PackageIcon from '@hugeicons/core-free-icons/PackageIcon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import SecurityCheckIcon from '@hugeicons/core-free-icons/SecurityCheckIcon';
import Target01Icon from '@hugeicons/core-free-icons/Target01Icon';
import UserGroupIcon from '@hugeicons/core-free-icons/UserGroupIcon';
import WorkflowSquare01Icon from '@hugeicons/core-free-icons/WorkflowSquare01Icon';

type IconProps = SVGProps<SVGSVGElement> & {
  size?: string | number;
  strokeWidth?: string | number;
};

function bold(icon: IconSvgElement): ComponentType<IconProps> {
  const BoldIcon = (props: IconProps) => (
    <HugeiconsIcon icon={icon} color="currentColor" {...props} strokeWidth={2.35} />
  );
  BoldIcon.displayName = 'HugeiconsBoldIcon';
  return BoldIcon;
}

export const ArrowLeft = bold(ArrowLeft01Icon);
export const ArrowRight = bold(ArrowRight01Icon);
export const Boxes = bold(PackageIcon);
export const Database = bold(Database02Icon);
export const GithubIcon = bold(HugeGithubIcon);
export const KeyRound = bold(LockKeyIcon);
export const LayoutGrid = bold(LayoutGridIcon);
export const Menu = bold(Menu01Icon);
export const Search = bold(Search01Icon);
export const Server = bold(ComputerProgramming01Icon);
export const ShieldCheck = bold(SecurityCheckIcon);
export const Target = bold(Target01Icon);
export const Terminal = bold(CommandLineIcon);
export const UsersRound = bold(UserGroupIcon);
export const Workflow = bold(WorkflowSquare01Icon);
export const X = bold(Cancel01Icon);
export type PoolstatisIcon = ComponentType<IconProps>;
