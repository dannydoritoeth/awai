import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface CardProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  color: string;
  href: string;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  icon: Icon,
  color,
  href,
  className = '',
}) => (
  <Link 
    href={href}
    className={`
      ${color} 
      ${className}
      p-6 
      rounded-xl 
      shadow-lg 
      transition-all
      hover:scale-[1.02]
      hover:shadow-xl
      block
    `}
  >
    <div className="flex items-start justify-between">
      <div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">{title}</h3>
        <p className="text-sm text-gray-600">{subtitle}</p>
      </div>
      <Icon className="w-8 h-8 text-gray-700" />
    </div>
  </Link>
); 