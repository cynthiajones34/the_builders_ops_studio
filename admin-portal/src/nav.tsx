import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Share2,
  PenLine,
  Mail,
  Video,
  FolderKanban,
  Users,
  TrendingUp,
  BookOpen,
  Sparkles,
  Target,
  FileBarChart,
  ClipboardList,
} from "lucide-react";

import Dashboard from "./modules/Dashboard";
import Social from "./modules/Social";
import Content from "./modules/Content";
import Email from "./modules/Email";
import Meetings from "./modules/Meetings";
import Projects from "./modules/Projects";
import Crm from "./modules/Crm";
import Pipeline from "./modules/Pipeline";
import Knowledge from "./modules/Knowledge";
import Assistant from "./modules/Assistant";
import Opportunities from "./modules/Opportunities";
import Reports from "./modules/Reports";
import DealBriefDashboard from "./modules/DealBriefDashboard";

export type Section = {
  path: string;
  label: string;
  group: string;
  icon: ComponentType<any>;
  Component: ComponentType;
};

export const sections: Section[] = [
  { path: "/dashboard", label: "Executive Dashboard", group: "Command", icon: LayoutDashboard, Component: Dashboard },
  { path: "/assistant", label: "AI Assistant", group: "Command", icon: Sparkles, Component: Assistant },
  { path: "/opportunities", label: "Opportunity Engine", group: "Command", icon: Target, Component: Opportunities },
  { path: "/reports", label: "Intelligence Reports", group: "Command", icon: FileBarChart, Component: Reports },
  { path: "/deal-brief", label: "Deal Brief", group: "Command", icon: ClipboardList, Component: DealBriefDashboard },

  { path: "/content", label: "Content Studio", group: "Create & Grow", icon: PenLine, Component: Content },
  { path: "/social", label: "Social Command", group: "Create & Grow", icon: Share2, Component: Social },

  { path: "/email", label: "Email Intelligence", group: "Operate", icon: Mail, Component: Email },
  { path: "/meetings", label: "Meeting Intelligence", group: "Operate", icon: Video, Component: Meetings },
  { path: "/projects", label: "Projects", group: "Operate", icon: FolderKanban, Component: Projects },

  { path: "/crm", label: "CRM & Relationships", group: "Business", icon: Users, Component: Crm },
  { path: "/pipeline", label: "BD Pipeline (SDR)", group: "Business", icon: TrendingUp, Component: Pipeline },
  { path: "/knowledge", label: "Knowledge Base", group: "Business", icon: BookOpen, Component: Knowledge },
];

export const groups = ["Command", "Create & Grow", "Operate", "Business"];
