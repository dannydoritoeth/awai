import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface Option {
  id: string;
  name: string;
  checked?: boolean;
}

interface CheckboxGroupProps {
  title: string;
  options: Option[];
  onChange: (id: string, checked: boolean) => void;
  maxVisible?: number;
}

export function CheckboxGroup({ 
  title, 
  options, 
  onChange, 
  maxVisible = 5 
}: CheckboxGroupProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleOptions = showAll ? options : options.slice(0, maxVisible);
  const hasMore = options.length > maxVisible;

  return (
    <div className="mb-4">
      <h3 className="text-[14px] font-medium text-gray-900 mb-2">{title}</h3>
      <div className="space-y-1">
        {visibleOptions.map((option) => (
          <div key={option.id} className="flex items-center">
            <Checkbox
              id={`${title}-${option.id}`}
              checked={option.checked}
              onCheckedChange={(checked: boolean) => onChange(option.id, checked)}
              className="h-[14px] w-[14px]"
            />
            <Label 
              htmlFor={`${title}-${option.id}`}
              className="ml-2 text-[14px] leading-[20px] text-gray-700 cursor-pointer"
            >
              {option.name}
            </Label>
          </div>
        ))}
      </div>
      {hasMore && (
        <Button
          variant="link"
          className="text-[14px] text-blue-600 hover:text-blue-800 hover:underline p-0 h-auto mt-1"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Show less' : 'Show more'}
        </Button>
      )}
    </div>
  );
} 