'use client';

import { useState } from 'react';

interface RoleData {
  jobTitle?: string;
  pageUpId?: string;
  description?: string;
  skills?: string;
  location?: string;
  employmentType?: string;
}

interface RoleInputFormProps {
  onSubmit: (data: RoleData) => void;
}

export default function RoleInputForm({ onSubmit }: RoleInputFormProps) {
  const [useExistingRole, setUseExistingRole] = useState(true);
  const [formData, setFormData] = useState<RoleData>({
    jobTitle: '',
    description: '',
    skills: '',
    location: '',
    employmentType: 'full-time',
    pageUpId: ''
  });

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const inputClasses = "w-full rounded-lg border-none focus:ring-0 bg-gray-50 text-gray-900 placeholder:text-gray-500 text-sm py-3 px-4";
  const labelClasses = "block text-base font-semibold text-gray-900 mb-2";

  return (
    <div className="space-y-8">
      {/* Toggle between PageUp and Manual Entry */}
      <div className="flex space-x-4 p-4 bg-gray-50 rounded-lg">
        <button
          onClick={() => setUseExistingRole(true)}
          className={`flex-1 py-3 px-4 rounded-lg text-base font-medium transition-colors
            ${useExistingRole 
              ? 'bg-blue-600 text-white' 
              : 'bg-transparent text-gray-800 hover:bg-gray-100'}`}
        >
          Select from PageUp
        </button>
        <button
          onClick={() => setUseExistingRole(false)}
          className={`flex-1 py-3 px-4 rounded-lg text-base font-medium transition-colors
            ${!useExistingRole 
              ? 'bg-blue-600 text-white' 
              : 'bg-transparent text-gray-800 hover:bg-gray-100'}`}
        >
          Define New Role
        </button>
      </div>

      {useExistingRole ? (
        // PageUp Role Selection
        <div className="space-y-6">
          <div>
            <label htmlFor="pageUpId" className={labelClasses}>
              Select Role from PageUp
            </label>
            <select
              id="pageUpId"
              className={inputClasses}
              value={formData.pageUpId}
              onChange={(e) => setFormData({ ...formData, pageUpId: e.target.value })}
            >
              <option value="">Select a role...</option>
              {/* PageUp roles will be populated here */}
            </select>
          </div>
        </div>
      ) : (
        // Manual Role Input Form
        <div className="space-y-6">
          <div>
            <label htmlFor="jobTitle" className={labelClasses}>
              Job Title
            </label>
            <input
              type="text"
              id="jobTitle"
              className={inputClasses}
              value={formData.jobTitle}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              placeholder="e.g., Senior Software Engineer"
            />
          </div>

          <div>
            <label htmlFor="description" className={labelClasses}>
              Job Description
            </label>
            <textarea
              id="description"
              rows={4}
              className={inputClasses}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the role, responsibilities, and requirements..."
            />
          </div>

          <div>
            <label htmlFor="skills" className={labelClasses}>
              Key Skills
            </label>
            <input
              type="text"
              id="skills"
              className={inputClasses}
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              placeholder="e.g., React, TypeScript, Node.js"
            />
            <p className="mt-2 text-sm text-gray-600">Separate skills with commas</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="location" className={labelClasses}>
                Location
              </label>
              <input
                type="text"
                id="location"
                className={inputClasses}
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Melbourne, VIC"
              />
            </div>

            <div>
              <label htmlFor="employmentType" className={labelClasses}>
                Employment Type
              </label>
              <select
                id="employmentType"
                className={inputClasses}
                value={formData.employmentType}
                onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
              >
                <option value="full-time">Full Time</option>
                <option value="part-time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="casual">Casual</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end pt-6">
        <button
          type="button"
          className="px-8 py-3 bg-blue-600 text-white text-base rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-semibold"
          onClick={handleSubmit}
        >
          Find Candidates
        </button>
      </div>
    </div>
  );
} 