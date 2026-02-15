'use client';

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Grid,
  Avatar,
  Button,
  Divider,
  Stack,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { ProfileData, Experience, Education, Skill, Language } from '@/types';

interface ProfileDisplayProps {
  data: ProfileData;
  onDownloadMarkdown: () => void;
  onDownloadHTML: () => void;
}

const ProfileDisplay: React.FC<ProfileDisplayProps> = ({
  data,
  onDownloadMarkdown,
  onDownloadHTML,
}) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Box sx={{ py: 2 }}>
      {/* Header Section */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'flex-start' }}>
            <Avatar
              sx={{
                width: 100,
                height: 100,
                bgcolor: 'rgba(255,255,255,0.3)',
                fontSize: '2.5rem',
                fontWeight: 'bold',
                flexShrink: 0,
              }}
            >
              {getInitials(data.personal.name)}
            </Avatar>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                {data.personal.name}
              </Typography>
              {data.personal.email && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <EmailIcon sx={{ fontSize: '1.2rem' }} />
                  <Typography variant="body2">{data.personal.email}</Typography>
                </Box>
              )}
              {data.personal.phone && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <PhoneIcon sx={{ fontSize: '1.2rem' }} />
                  <Typography variant="body2">{data.personal.phone}</Typography>
                </Box>
              )}
              {data.personal.address && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationOnIcon sx={{ fontSize: '1.2rem' }} />
                  <Typography variant="body2">{data.personal.address}</Typography>
                </Box>
              )}
            </Box>

            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              <Button
                variant="contained"
                color="inherit"
                size="small"
                startIcon={<FileDownloadIcon />}
                onClick={onDownloadMarkdown}
              >
                .md
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                startIcon={<FileDownloadIcon />}
                onClick={onDownloadHTML}
              >
                .html
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* Summary Section */}
      {data.summary && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              Professional Summary
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {data.summary}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Experience Section */}
      {data.experience.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              Work Experience
            </Typography>
            <Stack spacing={2}>
              {data.experience.map((exp: Experience, idx: number) => (
                <Box key={idx}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {exp.position}
                      </Typography>
                      <Typography variant="body2" color="primary">
                        {exp.company}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                      <Typography variant="caption" color="textSecondary">
                        {exp.startDate} - {exp.endDate}
                      </Typography>
                      {exp.isCurrent && (
                        <Box sx={{ mt: 0.5 }}>
                          <Chip label="Current" size="small" color="primary" />
                        </Box>
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ ml: 2 }}>
                    {exp.description.map((desc: string, didx: number) => (
                      <Typography key={didx} variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                        • {desc}
                      </Typography>
                    ))}
                  </Box>
                  {idx < data.experience.length - 1 && <Divider sx={{ mt: 2 }} />}
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Education Section */}
      {data.education.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              Education
            </Typography>
            <Stack spacing={2}>
              {data.education.map((edu: Education, idx: number) => (
                <Box key={idx}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {edu.school}
                      </Typography>
                      {edu.major && (
                        <Typography variant="body2" color="primary">
                          {edu.major}
                          {edu.degree && ` - ${edu.degree}`}
                        </Typography>
                      )}
                    </Box>
                    {edu.startYear && (
                      <Typography variant="caption" color="textSecondary" sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                        {edu.startYear}
                        {edu.endYear && ` - ${edu.endYear}`}
                      </Typography>
                    )}
                  </Box>
                  {edu.details && edu.details.length > 0 && (
                    <Box sx={{ ml: 2 }}>
                      {edu.details.map((detail: string, didx: number) => (
                        <Typography key={didx} variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                          • {detail}
                        </Typography>
                      ))}
                    </Box>
                  )}
                  {idx < data.education.length - 1 && <Divider sx={{ mt: 2 }} />}
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Skills Section */}
      {data.skills.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              Skills
            </Typography>
            <Stack spacing={2}>
              {data.skills.map((skillGroup: Skill, idx: number) => (
                <Box key={idx}>
                  {skillGroup.category && (
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {skillGroup.category}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {skillGroup.skills.map((skill: string, sidx: number) => (
                      <Chip key={sidx} label={skill} variant="outlined" color="primary" />
                    ))}
                  </Box>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Languages Section */}
      {data.languages && data.languages.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              Languages
            </Typography>
            <Grid container spacing={2}>
              {data.languages && data.languages.map((lang: Language, idx: number) => (
                <Grid key={idx} size={{ xs: 12, sm: 6 }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {lang.language}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {lang.proficiency}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ProfileDisplay;
