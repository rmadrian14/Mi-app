
CREATE POLICY "invoice_pdfs_users_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'invoice-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "invoice_pdfs_users_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'invoice-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "invoice_pdfs_users_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'invoice-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "invoice_pdfs_users_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'invoice-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
