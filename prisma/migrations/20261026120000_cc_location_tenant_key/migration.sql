-- CreateIndex
CREATE UNIQUE INDEX "Location_tenant_id_key" ON "Location"("tenantId", "id");
