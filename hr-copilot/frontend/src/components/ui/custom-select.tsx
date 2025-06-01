import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

export function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option",
}: CustomSelectProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-900">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-white border-gray-200 text-gray-900">
          <SelectValue placeholder={placeholder} className="text-gray-500" />
        </SelectTrigger>
        <SelectContent className="bg-white border-gray-200">
          {options.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
} 