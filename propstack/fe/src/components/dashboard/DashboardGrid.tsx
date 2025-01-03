import { Card } from '@/components/ui/Card';
import {
  Megaphone,
  Share2,
  BarChart3,
  Lightbulb,
  Users,
  ClipboardList,
} from 'lucide-react';
import { DashboardCard } from '@/types/dashboard';

const features: DashboardCard[] = [
  {
    title: 'Transactions',
    subtitle: 'Manage Workflow',
    icon: ClipboardList,
    color: 'bg-orange-50',
    href: '/transactions',
  },
  {
    title: 'Listings',
    subtitle: 'Manage your property listings',
    icon: Megaphone,
    color: 'bg-blue-50',
    href: '/listings'
  },
  {
    title: 'Data & Analytics',
    subtitle: 'Make Informed Decisions',
    icon: BarChart3,
    color: 'bg-green-50',
    href: '/analytics',
  },
  {
    title: 'Strategy',
    subtitle: 'Plan for Success',
    icon: Lightbulb,
    color: 'bg-yellow-50',
    href: '/strategy',
  },
];

export function DashboardGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {features.map((feature) => (
        <Card key={feature.title} {...feature} />
      ))}
    </div>
  )
} 