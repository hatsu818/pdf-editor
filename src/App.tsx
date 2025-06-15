import React, { useState, useRef } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Paper,
  IconButton,
  Divider
} from '@mui/material';
import {
  Upload,
  ZoomIn,
  ZoomOut,
  Edit,
  MergeType,
} from '@mui/icons-material';
import PDFViewer from './components/PDFViewer';
import PDFEditor from './components/PDFEditor';
import PDFMerger from './components/PDFMerger';
import './App.css';

function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'view' | 'edit' | 'merge'>('view');
  const [zoom, setZoom] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setMode('view');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" sx={{ bgcolor: '#2c2c2c' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            PDF Editor
          </Typography>
          
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
          
          <Button
            color="inherit"
            startIcon={<Upload />}
            onClick={handleUploadClick}
            sx={{ mr: 2 }}
          >
            Upload PDF
          </Button>
          
          {pdfFile && (
            <>
              <IconButton
                color="inherit"
                onClick={() => setZoom(zoom * 1.2)}
                sx={{ mr: 1 }}
              >
                <ZoomIn />
              </IconButton>
              
              <IconButton
                color="inherit"
                onClick={() => setZoom(zoom / 1.2)}
                sx={{ mr: 2 }}
              >
                <ZoomOut />
              </IconButton>
              
              <Divider orientation="vertical" flexItem sx={{ mx: 2, bgcolor: 'white' }} />
              
              <Button
                color={mode === 'view' ? 'primary' : 'inherit'}
                onClick={() => setMode('view')}
                sx={{ mr: 1 }}
              >
                View
              </Button>
              
              <Button
                color={mode === 'edit' ? 'primary' : 'inherit'}
                startIcon={<Edit />}
                onClick={() => setMode('edit')}
                sx={{ mr: 1 }}
              >
                Edit
              </Button>
              
              <Button
                color={mode === 'merge' ? 'primary' : 'inherit'}
                startIcon={<MergeType />}
                onClick={() => setMode('merge')}
                sx={{ mr: 2 }}
              >
                Merge
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      
      <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
        {!pdfFile ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              bgcolor: '#f5f5f5'
            }}
          >
            <Paper
              sx={{
                p: 4,
                textAlign: 'center',
                maxWidth: 400,
                border: '2px dashed #ccc'
              }}
            >
              <Upload sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Upload a PDF file to get started
              </Typography>
              <Button
                variant="contained"
                onClick={handleUploadClick}
                sx={{ mt: 2 }}
              >
                Choose PDF File
              </Button>
            </Paper>
          </Box>
        ) : (
          <>
            {mode === 'view' && <PDFViewer file={pdfFile} zoom={zoom} />}
            {mode === 'edit' && <PDFEditor file={pdfFile} zoom={zoom} />}
            {mode === 'merge' && <PDFMerger primaryFile={pdfFile} />}
          </>
        )}
      </Box>
    </Box>
  );
}

export default App;
