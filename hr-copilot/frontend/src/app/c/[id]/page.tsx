'use client';

import { useParams } from 'next/navigation';
import UnifiedResultsView from '../../components/UnifiedResultsView';
import { useEffect, useState } from 'react';

interface ChatData {
  id: string;
  type: 'role' | 'candidate' | 'general';
  employeeData?: {
    name: string;
    currentRole: string;
    department: string;
    tenure: string;
    skills: string[];
    preferences?: {
      desiredRoles: string[];
    };
  };
  roleData?: {
    id: string;
    title: string;
    department: string;
    location: string;
    description: string;
    requirements: string[];
    skills: string[];
  };
}

export default function ChatPage() {
  const params = useParams();
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // This would normally fetch from an API
    // For now, we'll simulate loading the data
    const loadChatData = async () => {
      setIsLoading(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock data based on ID
        const mockData: ChatData = {
          id: params.id as string,
          type: 'role',
          employeeData: {
            name: "John Smith",
            currentRole: "Software Engineer",
            department: "Engineering",
            tenure: "2 years",
            skills: ["JavaScript", "React", "Node.js", "TypeScript"],
            preferences: {
              desiredRoles: ["Senior Software Engineer", "Tech Lead", "Engineering Manager"]
            }
          },
          roleData: {
            id: params.id as string,
            title: "Senior Software Engineer",
            department: "Engineering",
            location: "Remote",
            description: "We're looking for a senior software engineer to join our team...",
            requirements: [
              "5+ years of experience with web technologies",
              "Strong knowledge of JavaScript and TypeScript",
              "Experience with React and Node.js"
            ],
            skills: ["JavaScript", "TypeScript", "React", "Node.js", "AWS"]
          }
        };

        setChatData(mockData);
      } catch (error) {
        console.error('Error loading chat data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) {
      loadChatData();
    }
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading chat...</div>
      </div>
    );
  }

  if (!chatData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Chat not found</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <UnifiedResultsView
        employeeData={chatData.employeeData}
        roleData={chatData.roleData}
        startContext={chatData.type === 'role' ? 'role' : chatData.type === 'candidate' ? 'employee' : 'open'}
      />
    </div>
  );
} 