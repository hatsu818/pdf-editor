import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Button, Divider, IconButton, ToggleButton, ToggleButtonGroup, Chip, Alert } from '@mui/material';
import { Save, Edit, Delete, ChevronLeft, ChevronRight, Add, FindReplace, ZoomIn, ZoomOut, Fullscreen, FullscreenExit } from '@mui/icons-material';
import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker設定 - 複数の方法を試す
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  console.log('PDF.js worker URL set to:', pdfjsLib.GlobalWorkerOptions.workerSrc);
} catch (error) {
  console.warn('Failed to set PDF.js worker, trying alternative:', error);
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

interface PDFEditorProps {
  file: File;
  zoom: number;
}

interface TextAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  isEditing: boolean;
  type: 'new' | 'existing';
  originalText?: string;
}

interface ExtractedText {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  pageIndex: number;
}

const PDFEditor: React.FC<PDFEditorProps> = ({ file, zoom }) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);
  const [extractedTexts, setExtractedTexts] = useState<ExtractedText[]>([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [sidebarWidth] = useState(350);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editMode, setEditMode] = useState<'add' | 'replace'>('add');
  const [loading, setLoading] = useState(false);
  const [pdfScale, setPdfScale] = useState(0.8);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      
      // 5秒のタイムアウトを設定
      const timeoutId = setTimeout(() => {
        console.warn('⏰ PDF text extraction timeout, showing demo texts');
        setLoading(false);
        const timeoutDemoTexts: ExtractedText[] = [
          {
            id: 'timeout_demo_1',
            text: 'Timeout Demo 1 (Click me!)',
            x: 100,
            y: 100,
            width: 170,
            height: 20,
            fontSize: 14,
            pageIndex: 0
          },
          {
            id: 'timeout_demo_2',
            text: 'Timeout Demo 2 (Click me!)',
            x: 200,
            y: 200,
            width: 170,
            height: 20,
            fontSize: 14,
            pageIndex: 0
          },
          {
            id: 'timeout_demo_3',
            text: 'Text extraction took too long',
            x: 300,
            y: 300,
            width: 200,
            height: 20,
            fontSize: 12,
            pageIndex: 0
          }
        ];
        setExtractedTexts(timeoutDemoTexts);
      }, 5000);
      
      extractTextFromPDF().finally(() => {
        clearTimeout(timeoutId);
      });
      
      return () => {
        URL.revokeObjectURL(url);
        clearTimeout(timeoutId);
      };
    }
  }, [file]);

  const extractTextFromPDF = async () => {
    try {
      setLoading(true);
      console.log('🔍 Starting PDF text extraction...');
      console.log('File type:', file.type);
      console.log('File size:', file.size);
      
      const arrayBuffer = await file.arrayBuffer();
      console.log('✅ File read as ArrayBuffer, size:', arrayBuffer.byteLength);
      
      // PDF.jsの設定を確認
      console.log('PDF.js version:', pdfjsLib.version);
      console.log('Worker source:', pdfjsLib.GlobalWorkerOptions.workerSrc);
      
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        verbosity: 1 // デバッグレベルを上げる
      });
      
      loadingTask.onProgress = (progress: any) => {
        console.log('Loading progress:', progress.loaded, '/', progress.total);
      };
      
      const pdf = await loadingTask.promise;
      console.log('✅ PDF loaded successfully, pages:', pdf.numPages);
      
      const allTexts: ExtractedText[] = [];
      
      // 最初のページのみ処理
      const page = await pdf.getPage(1);
      console.log('✅ Page 1 loaded');
      
      const textContent = await page.getTextContent();
      console.log('✅ Text content extracted, items:', textContent.items.length);
      
      if (textContent.items.length === 0) {
        console.warn('⚠️ No text items found in PDF');
      }
      
      const viewport = page.getViewport({ scale: 1.0 });
      console.log('✅ Viewport:', viewport.width, 'x', viewport.height);
      
      // 全てのテキストアイテムを詳細にログ出力
      textContent.items.forEach((item: any, index: number) => {
        console.log(`📝 Text item ${index}:`, {
          text: `"${item.str}"`,
          length: item.str?.length,
          transform: item.transform,
          width: item.width,
          height: item.height,
          hasOwnText: item.hasOwnProperty('str')
        });
      });
      
      let validItemCount = 0;
      textContent.items.forEach((item: any, index: number) => {
        // より緩い条件でテキストを検出
        if (item.str !== undefined && item.str !== null) {
          const text = String(item.str).trim();
          if (text.length > 0) {
            validItemCount++;
            const transform = item.transform || [12, 0, 0, 12, 0, 0];
            const x = transform[4] || 0;
            const y = transform[5] || 0;
            const scaleX = Math.abs(transform[0]) || 12;
            const scaleY = Math.abs(transform[3]) || 12;
            
            // より保守的な幅・高さ計算
            const calculatedWidth = item.width || Math.max(text.length * scaleX * 0.7, 30);
            const calculatedHeight = Math.max(scaleY, scaleX, 12);
            
            // Y座標の計算
            const adjustedY = Math.max(0, viewport.height - y - calculatedHeight);
            
            const textItem = {
              id: `extracted_1_${index}`,
              text: text,
              x: Math.max(0, x),
              y: adjustedY,
              width: calculatedWidth,
              height: calculatedHeight,
              fontSize: Math.max(scaleX, 10),
              pageIndex: 0
            };
            
            console.log(`✅ Added text item ${validItemCount}:`, textItem);
            allTexts.push(textItem);
          }
        }
      });
      
      console.log(`✅ Successfully processed ${validItemCount} text items`);
      console.log('Final extracted texts:', allTexts);
      
      if (allTexts.length > 0) {
        setExtractedTexts(allTexts);
      } else {
        console.log('⚠️ No valid text items found, adding demo texts');
        const demoTexts: ExtractedText[] = [
          {
            id: 'demo_1',
            text: 'Demo Text 1 (Click me!)',
            x: 100,
            y: 100,
            width: 150,
            height: 20,
            fontSize: 14,
            pageIndex: 0
          },
          {
            id: 'demo_2',
            text: 'Demo Text 2 (Click me!)',
            x: 200,
            y: 200,
            width: 150,
            height: 20,
            fontSize: 14,
            pageIndex: 0
          },
          {
            id: 'demo_3',
            text: 'Demo Text 3 (Click me!)',
            x: 300,
            y: 300,
            width: 150,
            height: 20,
            fontSize: 14,
            pageIndex: 0
          }
        ];
        setExtractedTexts(demoTexts);
      }
    } catch (error) {
      console.error('❌ PDF text extraction failed:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      } else {
        console.error('Unknown error type:', typeof error, error);
      }
      
      // エラー時は必ずデモテキストを表示
      const errorDemoTexts: ExtractedText[] = [
        {
          id: 'error_demo_1',
          text: 'Error Demo (Click me!)',
          x: 150,
          y: 150,
          width: 180,
          height: 25,
          fontSize: 16,
          pageIndex: 0
        },
        {
          id: 'error_demo_2',
          text: 'PDF parsing failed',
          x: 150,
          y: 200,
          width: 180,
          height: 25,
          fontSize: 14,
          pageIndex: 0
        }
      ];
      setExtractedTexts(errorDemoTexts);
    } finally {
      setLoading(false);
      console.log('🏁 Text extraction completed');
    }
  };

  const handlePDFClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (dragging) return; // ドラッグ中はクリックを無視
    
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    // PDF座標系に変換（800x1000のiframeサイズを基準）
    const pdfWidth = 800 * zoom * pdfScale;
    const pdfHeight = 1000 * zoom * pdfScale;
    
    // PDFの中央配置を考慮
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const pdfOffsetX = (containerWidth - pdfWidth) / 2;
    const pdfOffsetY = Math.max(80, (containerHeight - pdfHeight) / 2); // 上部ツールバー分のオフセット
    
    const x = (clickX - pdfOffsetX) / (zoom * pdfScale);
    const y = (clickY - pdfOffsetY) / (zoom * pdfScale);
    
    console.log('Click at:', x, y, 'Mode:', editMode);
    console.log('PDF area bounds:', pdfOffsetX, pdfOffsetY, pdfWidth, pdfHeight);
    
    // PDFエリア外のクリックは無視
    if (x < 0 || x > 800 || y < 0 || y > 1000) {
      console.log('Click outside PDF area');
      return;
    }
    
    if (editMode === 'add') {
      const newAnnotation: TextAnnotation = {
        id: Date.now().toString(),
        x: x,
        y: y,
        text: 'New text',
        fontSize: 14,
        isEditing: true,
        type: 'new'
      };
      
      setTextAnnotations([...textAnnotations, newAnnotation]);
      setSelectedAnnotation(newAnnotation.id);
    } else if (editMode === 'replace') {
      console.log('Looking for text at click position...');
      console.log('Available texts:', extractedTexts.length);
      
      // より大きな判定エリアでテキストを検索
      const clickedText = extractedTexts.find(text => {
        const margin = 25; // 判定マージンを拡大
        const isInBounds = x >= text.x - margin && 
                          x <= text.x + text.width + margin && 
                          y >= text.y - margin && 
                          y <= text.y + text.height + margin;
        
        console.log(`Text "${text.text}": pos(${text.x}, ${text.y}) size(${text.width}x${text.height}) click(${x}, ${y}) inBounds: ${isInBounds}`);
        
        return isInBounds;
      });
      
      if (clickedText) {
        console.log('Found clicked text:', clickedText.text);
        const existingAnnotation = textAnnotations.find(ann => ann.id === clickedText.id);
        
        if (!existingAnnotation) {
          const newAnnotation: TextAnnotation = {
            id: clickedText.id,
            x: clickedText.x,
            y: clickedText.y,
            text: clickedText.text,
            fontSize: clickedText.fontSize,
            isEditing: true,
            type: 'existing',
            originalText: clickedText.text
          };
          
          setTextAnnotations([...textAnnotations, newAnnotation]);
          setSelectedAnnotation(newAnnotation.id);
        } else {
          updateAnnotation(existingAnnotation.id, { isEditing: true });
          setSelectedAnnotation(existingAnnotation.id);
        }
      } else {
        console.log('No text found at click position');
        // 近くのテキストを表示してデバッグ
        const nearbyTexts = extractedTexts.filter(text => {
          const distance = Math.sqrt(Math.pow(x - text.x, 2) + Math.pow(y - text.y, 2));
          return distance < 100;
        }).sort((a, b) => {
          const distA = Math.sqrt(Math.pow(x - a.x, 2) + Math.pow(y - a.y, 2));
          const distB = Math.sqrt(Math.pow(x - b.x, 2) + Math.pow(y - b.y, 2));
          return distA - distB;
        });
        console.log('Nearby texts:', nearbyTexts.slice(0, 3));
      }
    }
  };
  
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>, annotationId: string) => {
    event.stopPropagation();
    setDragging(annotationId);
    setSelectedAnnotation(annotationId);
    
    const rect = event.currentTarget.getBoundingClientRect();
    const annotation = textAnnotations.find(ann => ann.id === annotationId);
    if (annotation) {
      setDragOffset({
        x: event.clientX - rect.left - annotation.x * zoom * pdfScale,
        y: event.clientY - rect.top - annotation.y * zoom * pdfScale
      });
    }
  };
  
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const pdfWidth = 800 * zoom * pdfScale;
    const pdfHeight = 1000 * zoom * pdfScale;
    const pdfOffsetX = (containerWidth - pdfWidth) / 2;
    const pdfOffsetY = Math.max(80, (containerHeight - pdfHeight) / 2);
    
    const relativeX = event.clientX - rect.left - pdfOffsetX - dragOffset.x;
    const relativeY = event.clientY - rect.top - pdfOffsetY - dragOffset.y;
    
    const x = relativeX / (zoom * pdfScale);
    const y = relativeY / (zoom * pdfScale);
    
    // PDF範囲内に制限
    const clampedX = Math.max(0, Math.min(800, x));
    const clampedY = Math.max(0, Math.min(1000, y));
    
    updateAnnotation(dragging, { x: clampedX, y: clampedY });
  };
  
  const handleMouseUp = () => {
    setDragging(null);
    setDragOffset({ x: 0, y: 0 });
  };

  const updateAnnotation = (id: string, updates: Partial<TextAnnotation>) => {
    setTextAnnotations(annotations =>
      annotations.map(ann => ann.id === id ? { ...ann, ...updates } : ann)
    );
  };

  const deleteAnnotation = (id: string) => {
    setTextAnnotations(annotations => annotations.filter(ann => ann.id !== id));
    setSelectedAnnotation(null);
  };

  const saveAnnotations = async () => {
    try {
      const existingPdfBytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      
      if (pages.length > 0) {
        const page = pages[0];
        
        // 既存テキストを白い矩形で上書き（隠す）
        textAnnotations
          .filter(ann => ann.type === 'existing')
          .forEach(annotation => {
            const extractedText = extractedTexts.find(t => t.id === annotation.id);
            if (extractedText) {
              page.drawRectangle({
                x: extractedText.x,
                y: page.getHeight() - extractedText.y - extractedText.height,
                width: extractedText.width,
                height: extractedText.height,
                color: rgb(1, 1, 1),
              });
            }
          });
        
        // 新しいテキストを追加
        textAnnotations.forEach(annotation => {
          page.drawText(annotation.text, {
            x: annotation.x,
            y: page.getHeight() - annotation.y - 20,
            size: annotation.fontSize,
            color: rgb(0, 0, 0),
          });
        });
      }
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited_${file.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to save PDF:', err);
      alert('Failed to save PDF. Please try again.');
    }
  };

  if (!fileUrl) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography variant="h6">Loading PDF for editing...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', position: 'relative' }}>
      {/* PDF表示エリア - 大幅に拡大 */}
      <Box
        sx={{
          flex: 1,
          height: '100%',
          overflow: 'auto',
          bgcolor: '#f0f0f0',
          position: 'relative',
          minWidth: 0 // flexboxで縮小可能にする
        }}
      >
        {/* PDF表示コントロール */}
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 30,
            display: 'flex',
            gap: 1,
            bgcolor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: 2,
            p: 1,
            boxShadow: 2
          }}
        >
          <IconButton
            size="small"
            onClick={() => setPdfScale(Math.max(0.3, pdfScale - 0.1))}
            title="Zoom Out"
          >
            <ZoomOut />
          </IconButton>
          <Typography variant="body2" sx={{ alignSelf: 'center', minWidth: 60, textAlign: 'center', fontWeight: 600 }}>
            {Math.round(pdfScale * 100)}%
          </Typography>
          <IconButton
            size="small"
            onClick={() => setPdfScale(Math.min(2, pdfScale + 0.1))}
            title="Zoom In"
          >
            <ZoomIn />
          </IconButton>
          <Divider orientation="vertical" flexItem />
          <IconButton
            size="small"
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <FullscreenExit /> : <Fullscreen />}
          </IconButton>
        </Box>

        {/* PDF表示コンテナ */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            p: 3,
            pt: 10, // ツールバー分のスペース
            minHeight: '100%'
          }}
        >
          <Paper
            elevation={6}
            sx={{
              position: 'relative',
              transform: `scale(${zoom * pdfScale})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s ease',
              cursor: editMode === 'add' ? 'crosshair' : 'pointer',
              bgcolor: 'white',
              overflow: 'hidden'
            }}
            onClick={handlePDFClick}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <iframe
              src={fileUrl}
              width="800"
              height="1000"
              style={{
                border: 'none',
                pointerEvents: 'none',
                display: 'block'
              }}
              title="PDF Editor"
            />
            
            {/* 既存テキストのハイライト（置換モードの時） */}
            {editMode === 'replace' && extractedTexts.map(text => (
              <Box
                key={text.id}
                sx={{
                  position: 'absolute',
                  left: text.x,
                  top: text.y,
                  width: Math.max(text.width, 20), // 最小幅を設定
                  height: Math.max(text.height, 12), // 最小高さを設定
                  bgcolor: 'rgba(255, 0, 0, 0.3)', // 赤色で目立つように
                  border: '2px solid rgba(255, 0, 0, 0.8)',
                  cursor: 'pointer',
                  zIndex: 5,
                  borderRadius: '2px',
                  '&:hover': {
                    bgcolor: 'rgba(255, 0, 0, 0.5)',
                    transform: 'scale(1.05)',
                  },
                  transition: 'all 0.2s ease',
                  '&:before': {
                    content: `"${text.text}"`,
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bgcolor: 'rgba(0, 0, 0, 0.9)',
                    color: 'white',
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    opacity: 0,
                    pointerEvents: 'none',
                    zIndex: 10,
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  },
                  '&:hover:before': {
                    opacity: 1
                  }
                }}
                title={`Click to edit: "${text.text}"`}
              />
            ))}
            
            {/* テキスト注釈のオーバーレイ */}
            {textAnnotations.map(annotation => (
              <Box
                key={annotation.id}
                sx={{
                  position: 'absolute',
                  left: annotation.x,
                  top: annotation.y,
                  minWidth: 150,
                  border: selectedAnnotation === annotation.id ? '2px solid #1976d2' : 
                         annotation.type === 'existing' ? '2px solid #ff9800' : '1px dashed #ccc',
                  bgcolor: annotation.type === 'existing' ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 255, 0, 0.3)',
                  cursor: dragging === annotation.id ? 'grabbing' : 'grab',
                  p: 0.5,
                  zIndex: 10,
                  borderRadius: 1
                }}
                onMouseDown={(e) => handleMouseDown(e, annotation.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!dragging) {
                    setSelectedAnnotation(annotation.id);
                  }
                }}
              >
                {dragging === annotation.id && (
                  <Typography variant="caption" sx={{ position: 'absolute', top: -20, left: 0, bgcolor: 'rgba(0,0,0,0.7)', color: 'white', px: 1, borderRadius: 1, fontSize: '10px' }}>
                    Drag to move
                  </Typography>
                )}
                {annotation.isEditing ? (
                  <TextField
                    value={annotation.text}
                    onChange={(e) => updateAnnotation(annotation.id, { text: e.target.value })}
                    onBlur={() => updateAnnotation(annotation.id, { isEditing: false })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateAnnotation(annotation.id, { isEditing: false });
                      }
                    }}
                    autoFocus
                    variant="standard"
                    slotProps={{
                      input: {
                        style: { fontSize: annotation.fontSize }
                      }
                    }}
                    sx={{ minWidth: 100 }}
                  />
                ) : (
                  <Typography
                    sx={{
                      fontSize: annotation.fontSize,
                      lineHeight: 1.2,
                      wordBreak: 'break-word',
                      minHeight: 20
                    }}
                    onDoubleClick={() => updateAnnotation(annotation.id, { isEditing: true })}
                  >
                    {annotation.text}
                  </Typography>
                )}
              </Box>
            ))}
          </Paper>
        </Box>
      </Box>
      
      {/* コンパクトなサイドパネル */}
      <Box
        sx={{
          width: sidebarCollapsed ? 0 : sidebarWidth,
          minWidth: sidebarCollapsed ? 0 : 300,
          maxWidth: 450,
          bgcolor: '#fafafa',
          borderLeft: '1px solid #ddd',
          overflow: 'hidden',
          transition: 'width 0.3s ease',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* 折りたたみボタン */}
        <IconButton
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          sx={{
            position: 'absolute',
            left: -20,
            top: '50%',
            transform: 'translateY(-50%)',
            bgcolor: 'white',
            border: '1px solid #ddd',
            width: 40,
            height: 40,
            zIndex: 20,
            boxShadow: 2,
            '&:hover': { bgcolor: '#f5f5f5' }
          }}
        >
          {sidebarCollapsed ? <ChevronLeft /> : <ChevronRight />}
        </IconButton>

        {!sidebarCollapsed && (
          <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#1976d2' }}>
              📝 PDF Editor
            </Typography>
            
            {/* 編集モード選択 */}
            <Paper sx={{ p: 2, mb: 2, bgcolor: '#f0f7ff' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                Edit Mode
              </Typography>
              <ToggleButtonGroup
                value={editMode}
                exclusive
                onChange={(_, newMode) => newMode && setEditMode(newMode)}
                sx={{ width: '100%' }}
              >
                <ToggleButton value="add" sx={{ flex: 1 }}>
                  <Add sx={{ mr: 1 }} /> Add
                </ToggleButton>
                <ToggleButton value="replace" sx={{ flex: 1 }}>
                  <FindReplace sx={{ mr: 1 }} /> Replace
                </ToggleButton>
              </ToggleButtonGroup>
            </Paper>
            
            {/* 状態表示 */}
            <Alert 
              severity={editMode === 'add' ? 'info' : 'warning'} 
              sx={{ mb: 2, fontSize: '0.875rem' }}
            >
              {editMode === 'add' ? (
                <>
                  <strong>Add Mode:</strong> Click anywhere to add new text
                </>
              ) : (
                <>
                  <strong>Replace Mode:</strong> Click on red highlighted text to edit
                  {loading && ' (Loading text...)'}
                  {!loading && extractedTexts.length === 0 && ' (No text detected)'}
                  {!loading && extractedTexts.length > 0 && ` (${extractedTexts.length} texts found)`}
                </>
              )}
            </Alert>
            
            {/* テスト用ボタン */}
            {editMode === 'replace' && (loading || extractedTexts.length === 0) && (
              <Paper sx={{ p: 2, mb: 2, bgcolor: '#fff3e0' }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                  🚀 Quick Test
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    console.log('🎯 Forcing demo texts for testing');
                    setLoading(false);
                    const testTexts: ExtractedText[] = [
                      {
                        id: 'test_1',
                        text: 'Test Text 1 (Click me!)',
                        x: 120,
                        y: 120,
                        width: 160,
                        height: 22,
                        fontSize: 14,
                        pageIndex: 0
                      },
                      {
                        id: 'test_2',
                        text: 'Test Text 2 (Click me!)',
                        x: 220,
                        y: 220,
                        width: 160,
                        height: 22,
                        fontSize: 14,
                        pageIndex: 0
                      }
                    ];
                    setExtractedTexts(testTexts);
                  }}
                  sx={{ width: '100%' }}
                >
                  Show Demo Texts Now
                </Button>
                <Typography variant="caption" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
                  Click this if text extraction is stuck
                </Typography>
              </Paper>
            )}
            
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={saveAnnotations}
              disabled={textAnnotations.length === 0}
              sx={{ mb: 2, width: '100%', py: 1.5 }}
            >
              Save PDF ({textAnnotations.length})
            </Button>
            
            {selectedAnnotation && (
              <Paper sx={{ p: 2, mb: 2, bgcolor: '#fff3e0' }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                  Selected: {textAnnotations.find(a => a.id === selectedAnnotation)?.type === 'existing' ? 'Original' : 'New'} Text
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Edit />}
                    onClick={() => updateAnnotation(selectedAnnotation, { isEditing: true })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<Delete />}
                    onClick={() => deleteAnnotation(selectedAnnotation)}
                  >
                    Delete
                  </Button>
                </Box>
              </Paper>
            )}
            
            {textAnnotations.length > 0 && (
              <Box>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                  Your Edits ({textAnnotations.length})
                </Typography>
                <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {textAnnotations.map(annotation => (
                    <Paper
                      key={annotation.id}
                      sx={{
                        p: 1.5,
                        mb: 1,
                        cursor: 'pointer',
                        bgcolor: selectedAnnotation === annotation.id ? '#e3f2fd' : 'white',
                        border: selectedAnnotation === annotation.id ? '2px solid #1976d2' : '1px solid #e0e0e0',
                        '&:hover': { bgcolor: '#f5f5f5' }
                      }}
                      onClick={() => setSelectedAnnotation(annotation.id)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Chip 
                          label={annotation.type === 'existing' ? 'Replace' : 'New'} 
                          size="small"
                          color={annotation.type === 'existing' ? 'warning' : 'primary'}
                        />
                      </Box>
                      <Typography variant="body2" noWrap>
                        "{annotation.text}"
                      </Typography>
                      {annotation.originalText && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          Was: "{annotation.originalText}"
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </Box>
              </Box>
            )}
            
            {/* デバッグ情報 */}
            <Paper sx={{ p: 2, mt: 2, bgcolor: '#f0f7ff' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                🔍 Debug Info
              </Typography>
              <Typography variant="caption" display="block">
                Extracted texts: {extractedTexts.length}
              </Typography>
              <Typography variant="caption" display="block">
                Mode: {editMode}
              </Typography>
              {loading && (
                <Typography variant="caption" display="block" color="warning.main">
                  Loading text...
                </Typography>
              )}
              {extractedTexts.length > 0 && (
                <Box sx={{ mt: 1, maxHeight: 100, overflow: 'auto' }}>
                  {extractedTexts.slice(0, 3).map((text, index) => (
                    <Typography key={index} variant="caption" display="block" sx={{ fontFamily: 'monospace', fontSize: '10px' }}>
                      {index + 1}: "{text.text}" at ({Math.round(text.x)}, {Math.round(text.y)})
                    </Typography>
                  ))}
                  {extractedTexts.length > 3 && (
                    <Typography variant="caption" display="block">
                      ... and {extractedTexts.length - 3} more
                    </Typography>
                  )}
                </Box>
              )}
              <Typography variant="caption" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
                Check browser console (F12) for detailed logs
              </Typography>
            </Paper>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default PDFEditor;