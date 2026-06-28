import { Router, Request, Response } from 'express';
import Document from '../models/Document';
import { validateDocumentId } from '../middleware/validation';
import { logger } from '../services/logger';

const router = Router();

// Create new document
router.post('/documents', async (req: Request, res: Response) => {
  try {
    logger.info('Creating document', { title: req.body.title });

    const doc = await Document.create({
      title: req.body.title || 'Untitled',
      content: req.body.content || '',
      version: 0,
      operations: []
    });

    logger.info('Document created successfully', { documentId: doc._id.toString() });
    res.status(201).json(doc);
  } catch (error: any) {
    logger.error('Error creating document', { error: error.message });
    res.status(500).json({ error: 'Failed to create document', details: error.message });
  }
});

// Get document by ID
router.get('/documents/:id', validateDocumentId, async (req: Request, res: Response) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      logger.warn('Document not found', { documentId: req.params.id });
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    logger.debug('Document fetched', { documentId: req.params.id });
    res.json(doc);
  } catch (error: any) {
    logger.error('Error fetching document', { documentId: req.params.id, error: error.message });
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Get all documents
router.get('/documents', async (req: Request, res: Response) => {
  try {
    const docs = await Document.find().sort({ updatedAt: -1 });
    logger.debug('Fetched all documents', { count: docs.length });
    res.json(docs);
  } catch (error: any) {
    logger.error('Error fetching documents', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Delete document
router.delete('/documents/:id', validateDocumentId, async (req: Request, res: Response) => {
  try {
    const doc = await Document.findByIdAndDelete(req.params.id);
    if (!doc) {
      logger.warn('Document not found for deletion', { documentId: req.params.id });
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    logger.info('Document deleted', { documentId: req.params.id });
    res.json({ message: 'Document deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting document', { documentId: req.params.id, error: error.message });
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;