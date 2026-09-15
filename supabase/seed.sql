-- Default Store
INSERT INTO public.stores (id, name, address, active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Print Infinity Flagship — Store #1',
    'Shop 12, Retail Arcade, Commercial Center',
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- Default Printers for Store #1
INSERT INTO public.printers (id, store_id, name, type, connection, windows_printer_name, is_online)
VALUES 
    (
        'b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        'HP LaserJet Pro B&W (Counter 1)',
        'bw',
        'usb',
        'HP_LaserJet_Pro_M404dn',
        TRUE
    ),
    (
        'b0000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000001',
        'Canon imageRUNNER Color Multi',
        'color',
        'wifi',
        'Canon_iR_C3226',
        TRUE
    )
ON CONFLICT (id) DO NOTHING;
