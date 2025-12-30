/**
 * Message Redirect Page (/messages/:id)
 *
 * Parses the message ID and redirects to the session page
 * with the message highlighted via URL hash.
 *
 * Message ID format: Message:{projectDir}:{sessionId}:{lineNumber}
 */
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Center } from '@/components/atoms/Center.tsx';
import { Text } from '@/components/atoms/Text.tsx';

export default function MessageRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) {
      navigate('/', { replace: true });
      return;
    }

    // Parse message ID: Message:{projectDir}:{sessionId}:{lineNumber}
    const parts = id.split(':');
    if (parts.length >= 3 && parts[0] === 'Message') {
      // parts[1] = projectDir (may contain colons in path)
      // parts[parts.length - 1] = lineNumber
      // parts[parts.length - 2] = sessionId
      const sessionId = parts[parts.length - 2];
      if (sessionId) {
        // Redirect to session page with message hash
        navigate(`/sessions/${sessionId}#${encodeURIComponent(id)}`, {
          replace: true,
        });
        return;
      }
    }

    // Invalid message ID format, go home
    navigate('/', { replace: true });
  }, [id, navigate]);

  return (
    <Center style={{ height: '100%' }}>
      <Text color="muted">Redirecting to message...</Text>
    </Center>
  );
}
