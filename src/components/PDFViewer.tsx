import React, { useState, useEffect } from 'react';
import { Box, Paper, CircularProgress, Typography } from '@mui/material';

interface PDFViewerProps {
  file: File;
  zoom: number;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ file, zoom }) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      try {
        const url = URL.createObjectURL(file);
        setFileUrl(url);
        setLoading(false);
        return () => URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Error creating object URL:', err);
        setError('Failed to load PDF file');
        setLoading(false);
      }
    }
  }, [file]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%'
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading PDF...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%'
        }}
      >
        <Typography variant="h6" color="error">
          {error}
        </Typography>
      </Box>
    );
  }

  if (!fileUrl) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%'
        }}
      >
        <Typography variant="h6">
          No PDF file selected
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        bgcolor: '#e0e0e0',
        p: 2
      }}
    >
      <Paper
        elevation={3}
        sx={{
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transform: `scale(${zoom})`,
          transformOrigin: 'center',
          transition: 'transform 0.2s ease'
        }}
      >
        <iframe
          src={fileUrl}
          width="100%"
          height="100%"
          style={{
            border: 'none',
            minHeight: '600px'
          }}
          title="PDF Viewer"
        />
      </Paper>
    </Box>
  );
};

export default PDFViewer;