"use client";

import React from "react";
import {
  Activity,
  BarChart3,
  CheckCircle,
  CreditCard,
  Crown,
  DollarSign,
  FileText,
  GitPullRequest,
  Globe,
  Layers,
  LayoutDashboard,
  MapPin,
  Network,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Users,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Sliders,
  GitPullRequest,
  CheckCircle,
  CreditCard,
  MapPin,
  Crown,
  Activity,
  ShieldAlert,
  DollarSign,
  Globe,
  Shield,
  ShieldCheck,
  Network,
  Layers,
};

interface DynamicIconProps extends LucideProps {
  name: string;
}

export default function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const IconComponent = ICON_MAP[name] || Layers;
  return <IconComponent {...props} />;
}
