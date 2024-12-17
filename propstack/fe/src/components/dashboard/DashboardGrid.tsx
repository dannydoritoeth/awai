import { Card } from '@/components/ui/Card';
import {
  Megaphone,
  Share2,
  BarChart3,
  Lightbulb,
  Users,
  ClipboardList,
} from 'lucide-react';

const features = [
  {
    title: 'Marketing',
    subtitle: 'Reach the Right Audience',
    icon: Megaphone,
    color: 'bg-blue-50',
    href: '/marketing',
  },
  {
    title: 'Social Media',
    subtitle: 'Amplify Your Presence',
    icon: Share2,
    color: 'bg-purple-50',
    href: '/social',
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
  {
    title: 'Referrals',
    subtitle: 'Connect with an Agent',
    icon: Users,
    color: 'bg-pink-50',
    href: '/referrals',
  },
  {
    title: 'Transactions',
    subtitle: 'Manage Workflow',
    icon: ClipboardList,
    color: 'bg-orange-50',
    href: '/transactions',
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