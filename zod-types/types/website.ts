import { z } from 'zod';

const WebsiteSchema = z.string().url('Invalid URL format')

export default WebsiteSchema
