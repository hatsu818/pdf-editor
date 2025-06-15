import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  Add,
  Delete,
  ArrowUpward,
  ArrowDownward,
  MergeType,
} from '@mui/icons-material';
import { PDFDocument } from 'pdf-lib';

interface PDFMergerProps {
  primaryFile: File;
}

interface PDFFile {
  id: string;
  file: File;
  name: string;
  pages: number;
}

const PDFMerger: React.FC<PDFMergerProps> = ({ primaryFile }) => {
  const [pdfFiles, setPdfFiles] = useState<PDFFile[]>([
    {
      id: '1',
      file: primaryFile,
      name: primaryFile.name,
      pages: 0
    }
  ]);
  const [merging, setMerging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles: PDFFile[] = Array.from(files).map(file => ({
        id: Date.now().toString() + Math.random().toString(),
        file,
        name: file.name,
        pages: 0
      }));
      setPdfFiles([...pdfFiles, ...newFiles]);
    }
  };

  const handleAddClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (id: string) => {
    if (pdfFiles.length > 1) {
      setPdfFiles(pdfFiles.filter(file => file.id !== id));
    }
  };

  const moveFileUp = (index: number) => {
    if (index > 0) {
      const newFiles = [...pdfFiles];
      [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
      setPdfFiles(newFiles);
    }
  };

  const moveFileDown = (index: number) => {
    if (index < pdfFiles.length - 1) {
      const newFiles = [...pdfFiles];
      [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
      setPdfFiles(newFiles);
    }
  };

  const mergePDFs = async () => {
    try {
      setMerging(true);
      
      const mergedPdf = await PDFDocument.create();
      
      for (const pdfFile of pdfFiles) {
        const arrayBuffer = await pdfFile.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      }
      
      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged_${Date.now()}.pdf`;
      a.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to merge PDFs:', error);
      alert('Failed to merge PDFs. Please try again.');
    } finally {
      setMerging(false);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex' }}>
      <Box
        sx={{
          width: 400,
          bgcolor: '#f5f5f5',
          borderRight: '1px solid #ddd',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            PDF Merger
          </Typography>
          
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={handleAddFiles}
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
          
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={handleAddClick}
            sx={{ mb: 2, width: '100%' }}
          >
            Add More PDFs
          </Button>
          
          <Button
            variant="contained"
            startIcon={<MergeType />}
            onClick={mergePDFs}
            disabled={pdfFiles.length < 2 || merging}
            sx={{ mb: 2, width: '100%' }}
          >
            {merging ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Merging...
              </>
            ) : (
              'Merge PDFs'
            )}
          </Button>
        </Box>
        
        <Divider />
        
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <List dense>
            {pdfFiles.map((pdfFile, index) => (
              <ListItem key={pdfFile.id} divider>
                <ListItemText
                  primary={pdfFile.name}
                  secondary={`File ${index + 1}`}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => moveFileUp(index)}
                    disabled={index === 0}
                    size="small"
                  >
                    <ArrowUpward />
                  </IconButton>
                  <IconButton
                    edge="end"
                    onClick={() => moveFileDown(index)}
                    disabled={index === pdfFiles.length - 1}
                    size="small"
                  >
                    <ArrowDownward />
                  </IconButton>
                  <IconButton
                    edge="end"
                    onClick={() => removeFile(pdfFile.id)}
                    disabled={pdfFiles.length <= 1}
                    size="small"
                    color="error"
                  >
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      </Box>
      
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
          bgcolor: '#fafafa'
        }}
      >
        <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            maxWidth: 500,
            bgcolor: 'white'
          }}
        >
          <MergeType sx={{ fontSize: 64, color: '#1976d2', mb: 2 }} />
          
          <Typography variant="h5" gutterBottom>
            PDF Merger
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Add multiple PDF files and merge them into a single document. 
            Use the arrow buttons to reorder files before merging.
          </Typography>
          
          <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1, mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Current Files: {pdfFiles.length}
            </Typography>
            {pdfFiles.map((file, index) => (
              <Typography key={file.id} variant="body2" color="text.secondary">
                {index + 1}. {file.name}
              </Typography>
            ))}
          </Box>
          
          <Typography variant="body2" color="text.secondary">
            {pdfFiles.length < 2 
              ? 'Add at least one more PDF file to enable merging.'
              : `Ready to merge ${pdfFiles.length} PDF files.`
            }
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

export default PDFMerger;